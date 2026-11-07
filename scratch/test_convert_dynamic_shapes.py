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
        encoder_outputs, hidden = model.transformer.encoder(src)
        
    print("Testing Encoder export with dynamic_shapes...")
    seq_len_dim = torch.export.Dim("seq_len")
    
    torch.onnx.export(
        model.transformer.encoder,
        src,
        'scratch/test_encoder_dynamic.onnx',
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['src'],
        output_names=['encoder_outputs', 'hidden'],
        dynamic_shapes={
            "src": {0: seq_len_dim}
        }
    )
    print("Export succeeded!")

if __name__ == '__main__':
    main()
