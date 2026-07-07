import os
import torch
import onnx
import numpy as np
from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model

def main():
    print("Initializing Cfg...")
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    config['cnn']['pretrained'] = True
    
    print("Building model and loading weights...")
    from vietocr.tool.predictor import Predictor
    predictor = Predictor(config)
    model = predictor.model
    vocab = predictor.vocab
    model = model.eval()

    output_dir = 'public/models'
    os.makedirs(output_dir, exist_ok=True)
    
    print("Converting CNN part...")
    img = torch.rand(1, 3, 32, 448)
    with torch.no_grad():
        src = model.cnn(img)
        # Define width as 4 * w_div4 so it is always a multiple of 4
        # (required by VGG pooling layers to avoid fractional shape mismatch)
        _width = torch.export.Dim("w_div4")
        width_dim = 4 * _width
        torch.onnx.export(
            model.cnn, 
            img, 
            os.path.join(output_dir, 'vietocr_cnn.onnx'), 
            export_params=True, 
            opset_version=12, 
            do_constant_folding=True, 
            input_names=['img'], 
            output_names=['output'],
            dynamic_shapes={
                "x": {3: width_dim}
            },
            external_data=False
        )

    print("Converting Encoder part...")
    with torch.no_grad():
        encoder_outputs, hidden = model.transformer.encoder(src)
        traced_encoder = torch.jit.trace(model.transformer.encoder, (src,))
        torch.onnx.export(
            traced_encoder, 
            src, 
            os.path.join(output_dir, 'vietocr_encoder.onnx'), 
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

    print("Converting Decoder part...")
    with torch.no_grad():
        device = img.device
        tgt = torch.LongTensor([[1] * len(img)]).to(device)
        tgt_in = tgt[-1]
        seq_len_dim_dec = torch.export.Dim("seq_len")
        torch.onnx.export(
            model.transformer.decoder,
            (tgt_in, hidden, encoder_outputs),
            os.path.join(output_dir, 'vietocr_decoder.onnx'),
            export_params=True,
            opset_version=11,
            do_constant_folding=True,
            input_names=['tgt', 'hidden', 'encoder_outputs'],
            output_names=['output', 'hidden_out', 'last'],
            dynamic_shapes={
                "input": None,
                "hidden": None,
                "encoder_outputs": {0: seq_len_dim_dec}
            },
            external_data=False
        )

    print("Saving dictionary/vocab...")
    # Save the vocabulary mapping (index to character)
    # Vocab has w2i and i2w.
    chars = vocab.chars if hasattr(vocab, 'chars') else list(vocab.w2i.keys())
    with open(os.path.join(output_dir, 'vietocr_dict.txt'), 'w', encoding='utf-8') as f:
        # VietOCR vocab files are usually just one character per line, starting from index 0 or similar
        # Let's save each character on its own line
        for char in chars:
            f.write(f"{char}\n")

    print("All done!")

if __name__ == '__main__':
    main()
