import torch
from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model
import os

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    model, vocab = build_model(config)
    model.eval()
    
    img = torch.rand(1, 3, 32, 448)
    with torch.no_grad():
        src = model.cnn(img)
        traced_encoder = torch.jit.trace(model.transformer.encoder, (src,))
        
    print("Testing export with dynamo=False...")
    torch.onnx.export(
        traced_encoder, 
        src, 
        'scratch/test_encoder_legacy.onnx', 
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
    print("Export succeeded with dynamo=False!")

if __name__ == '__main__':
    main()
