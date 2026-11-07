import torch
from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model
import os
import onnx
import onnxruntime as ort
import numpy as np
from PIL import Image
Image.ANTIALIAS = Image.Resampling.LANCZOS
import math

def main():
    print("Initializing Cfg...")
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    config['cnn']['pretrained'] = True
    
    print("Building model and loading weights...")
    from vietocr.tool.predictor import Predictor
    predictor = Predictor(config)
    model = predictor.model
    model = model.eval()
    
    with open('public/models/vietocr_dict.txt', 'r', encoding='utf-8') as f:
        vocab = [line.strip('\r\n') for line in f]
    
    output_dir = 'scratch/hybrid_models'
    os.makedirs(output_dir, exist_ok=True)
    
    # Patch VietOCR's resize to use multiple of 20
    import vietocr.tool.translate as translate_module
    orig_resize = translate_module.resize
    def custom_resize(w, h, expected_height, image_min_width, image_max_width):
        new_w, eh = orig_resize(w, h, expected_height, image_min_width, image_max_width)
        new_w = int(math.ceil(new_w / 20.0) * 20)
        return new_w, eh
    translate_module.resize = custom_resize
    
    img = torch.rand(1, 3, 32, 448)
    with torch.no_grad():
        src = model.cnn(img)
        encoder_outputs, hidden = model.transformer.encoder(src)
        
    print("Converting CNN part using dynamo=True...")
    width_dim = torch.export.Dim("width")
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
        }
    )

    print("Converting Encoder part using dynamo=False + JIT trace...")
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

    print("Converting Decoder part using dynamo=True...")
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
        }
    )
    
    print("\nLoading exported ONNX models into ONNX Runtime sessions...")
    cnn_sess = ort.InferenceSession(os.path.join(output_dir, 'vietocr_cnn.onnx'))
    encoder_sess = ort.InferenceSession(os.path.join(output_dir, 'vietocr_encoder.onnx'))
    decoder_sess = ort.InferenceSession(os.path.join(output_dir, 'vietocr_decoder.onnx'))
    print("Sessions loaded successfully!")
    
    # Verify ONNX model shapes
    print("\nVerifying ONNX input/output shapes:")
    for name, sess in [("CNN", cnn_sess), ("Encoder", encoder_sess), ("Decoder", decoder_sess)]:
        print(f"\n{name} Model:")
        for inp in sess.get_inputs():
            print(f"  Input '{inp.name}': shape={inp.shape}")
        for out in sess.get_outputs():
            print(f"  Output '{out.name}': shape={out.shape}")
            
    # Run end-to-end on user image
    img_path = 'C:/Users/Admin/.gemini/antigravity-ide/brain/c4b36347-1099-41d7-8139-8ad5650eddc3/media__1783410949837.png'
    if os.path.exists(img_path):
        print(f"\nRunning end-to-end OCR on: {img_path}")
        user_img = Image.open(img_path).convert('RGB')
        w, h = user_img.size
        # Round width to a multiple of 20
        new_w = int(32 * float(w) / float(h))
        new_w = int(math.ceil(new_w / 20.0) * 20)
        print(f"Resized image dimension: {new_w}x32 (original: {w}x{h})")
        
        resized_img = user_img.resize((new_w, 32), Image.Resampling.LANCZOS)
        img_np = np.array(resized_img, dtype=np.float32)
        img_np = np.transpose(img_np, (2, 0, 1)) / 255.0
        img_np = np.expand_dims(img_np, axis=0)
        
        # PyTorch Reference Run
        with torch.no_grad():
            ref_txt = predictor.predict(user_img)
        print(f"PyTorch prediction: {ref_txt}")
        
        # ONNX Run
        print("ONNX Run step-by-step...")
        # 1. CNN
        src_onnx = cnn_sess.run(None, {'img': img_np})[0]
        # 2. Encoder
        encoder_outputs_onnx, hidden_onnx = encoder_sess.run(None, {'src': src_onnx})
        
        # 3. Decoder Loop
        translated_sentence = []
        max_seq_len = 128
        tgt_onnx = np.array([1], dtype=np.int64) # SOS token
        
        for i in range(max_seq_len):
            output_onnx, hidden_onnx, _ = decoder_sess.run(None, {
                'tgt': tgt_onnx,
                'hidden': hidden_onnx,
                'encoder_outputs': encoder_outputs_onnx
            })
            
            # Argmax
            char_id = int(np.argmax(output_onnx, axis=-1)[0])
            if char_id == 2: # EOS token
                break
            if char_id >= 4:
                translated_sentence.append(vocab[char_id - 4])
            tgt_onnx = np.array([char_id], dtype=np.int64)
            
        onnx_txt = "".join(translated_sentence)
        print(f"ONNX prediction:    {onnx_txt}")
        
        if ref_txt == onnx_txt:
            print("\nSUCCESS: PyTorch and ONNX outputs match exactly!")
        else:
            print("\nFAIL: Output mismatch!")
            
if __name__ == '__main__':
    main()
