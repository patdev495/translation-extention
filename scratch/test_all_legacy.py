import torch
from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model
import os
import onnx

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    model, vocab = build_model(config)
    model.eval()
    
    img = torch.rand(1, 3, 32, 448)
    with torch.no_grad():
        src = model.cnn(img)
        encoder_outputs, hidden = model.transformer.encoder(src)
        
    os.makedirs('scratch/legacy_models', exist_ok=True)
    
    print("Exporting CNN...")
    torch.onnx.export(
        model.cnn, 
        img, 
        'scratch/legacy_models/vietocr_cnn.onnx', 
        export_params=True, 
        opset_version=12, 
        do_constant_folding=True, 
        input_names=['img'], 
        output_names=['output'],
        dynamic_axes={
            'img': {3: 'width'},
            'output': {1: 'seq_len'}
        },
        dynamo=False
    )
    
    print("Exporting Encoder...")
    traced_encoder = torch.jit.trace(model.transformer.encoder, (src,))
    torch.onnx.export(
        traced_encoder, 
        src, 
        'scratch/legacy_models/vietocr_encoder.onnx', 
        export_params=True, 
        opset_version=11, 
        do_constant_folding=True, 
        input_names=['src'], 
        output_names=['encoder_outputs', 'hidden'],
        dynamic_axes={
            'src': {0: 'seq_len'},
            'encoder_outputs': {0: 'seq_len'}
        },
        dynamo=False
    )
    
    print("Exporting Decoder...")
    device = img.device
    tgt = torch.LongTensor([[1] * len(img)]).to(device)
    tgt_in = tgt[-1]
    torch.onnx.export(
        model.transformer.decoder,
        (tgt_in, hidden, encoder_outputs),
        'scratch/legacy_models/vietocr_decoder.onnx',
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['tgt', 'hidden', 'encoder_outputs'],
        output_names=['output', 'hidden_out', 'last'],
        dynamic_axes={
            'encoder_outputs': {0: 'seq_len'}
        },
        dynamo=False
    )
    
    print("All exports succeeded with dynamo=False!")

if __name__ == '__main__':
    main()
