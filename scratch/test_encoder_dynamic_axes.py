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
        
    print("Exporting Encoder using dynamic_axes on raw nn.Module...")
    torch.onnx.export(
        model.transformer.encoder,
        src,
        'scratch/test_encoder_axes.onnx',
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['src'],
        output_names=['encoder_outputs', 'hidden'],
        dynamic_axes={
            'src': {0: 'seq_len'},
            'encoder_outputs': {0: 'seq_len'}
        }
    )
    
    print("\nVerifying exported ONNX shapes:")
    onnx_model = onnx.load('scratch/test_encoder_axes.onnx')
    for inp in onnx_model.graph.input:
        shape = [dim.dim_value if dim.HasField('dim_value') else dim.dim_param for dim in inp.type.tensor_type.shape.dim]
        print(f"Input '{inp.name}': shape={shape}")
        
    for out in onnx_model.graph.output:
        shape = [dim.dim_value if dim.HasField('dim_value') else dim.dim_param for dim in out.type.tensor_type.shape.dim]
        print(f"Output '{out.name}': shape={shape}")

if __name__ == '__main__':
    main()
