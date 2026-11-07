import torch
from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model
import os
import onnxruntime as ort
import numpy as np
from PIL import Image
import math

# Patch PIL for older compatibility in VietOCR
from PIL import Image
Image.ANTIALIAS = Image.Resampling.LANCZOS

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    
    from vietocr.tool.predictor import Predictor
    predictor = Predictor(config)
    model = predictor.model
    model.eval()
    
    with open('public/models/vietocr_dict.txt', 'r', encoding='utf-8') as f:
        vocab = [line.strip('\r\n') for line in f]
        
    img_path = 'C:/Users/Admin/.gemini/antigravity-ide/brain/c4b36347-1099-41d7-8139-8ad5650eddc3/media__1783410949837.png'
    user_img = Image.open(img_path).convert('RGB')
    
    # 1. Preprocess
    w, h = user_img.size
    new_w = int(32 * float(w) / float(h))
    new_w = int(math.ceil(new_w / 20.0) * 20)
    
    resized_img = user_img.resize((new_w, 32), Image.Resampling.LANCZOS)
    img_np = np.array(resized_img, dtype=np.float32).transpose(2, 0, 1) / 255.0
    img_np = np.expand_dims(img_np, axis=0)
    
    # Load ONNX
    cnn_sess = ort.InferenceSession('scratch/hybrid_models/vietocr_cnn.onnx')
    encoder_sess = ort.InferenceSession('scratch/hybrid_models/vietocr_encoder.onnx')
    decoder_sess = ort.InferenceSession('scratch/hybrid_models/vietocr_decoder.onnx')
    
    # PyTorch Run
    print("--- Running PyTorch Step-by-Step ---")
    img_torch = torch.FloatTensor(img_np)
    with torch.no_grad():
        src_pt = model.cnn(img_torch)
        encoder_outputs_pt, hidden_pt = model.transformer.encoder(src_pt)
        
        translated_pt = [1]
        max_seq_len = 128
        
        # ONNX Run init
        src_onnx = cnn_sess.run(None, {'img': img_np})[0]
        encoder_outputs_onnx, hidden_onnx = encoder_sess.run(None, {'src': src_onnx})
        
        translated_onnx = [1]
        
        # Print differences between CNN and Encoder output
        print(f"CNN output difference L1 norm: {np.linalg.norm(src_pt.numpy() - src_onnx)}")
        print(f"Encoder outputs difference L1 norm: {np.linalg.norm(encoder_outputs_pt.numpy() - encoder_outputs_onnx)}")
        print(f"Encoder hidden difference L1 norm: {np.linalg.norm(hidden_pt.numpy() - hidden_onnx)}")
        
        print("\n--- Decoding Step Comparison ---")
        for step in range(max_seq_len):
            # PyTorch step
            tgt_pt = torch.LongTensor([translated_pt[-1]])
            out_pt, hidden_pt, _ = model.transformer.decoder(tgt_pt, hidden_pt, encoder_outputs_pt)
            
            # Apply softmax like in translate
            out_pt_prob = torch.softmax(out_pt, dim=-1)
            char_id_pt = int(torch.argmax(out_pt_prob, dim=-1)[0])
            prob_pt = float(out_pt_prob[0, char_id_pt])
            
            # ONNX step
            tgt_onnx = np.array([translated_onnx[-1]], dtype=np.int64)
            out_onnx, hidden_onnx, _ = decoder_sess.run(None, {
                'tgt': tgt_onnx,
                'hidden': hidden_onnx,
                'encoder_outputs': encoder_outputs_onnx
            })
            # Apply softmax to ONNX output
            out_onnx_prob = np.exp(out_onnx) / np.sum(np.exp(out_onnx), axis=-1, keepdims=True)
            char_id_onnx = int(np.argmax(out_onnx_prob, axis=-1)[0])
            prob_onnx = float(out_onnx_prob[0, char_id_onnx])
            
            char_pt_str = vocab[char_id_pt - 4] if char_id_pt >= 4 else f"<{char_id_pt}>"
            char_onnx_str = vocab[char_id_onnx - 4] if char_id_onnx >= 4 else f"<{char_id_onnx}>"
            
            print(f"Step {step:02d} | PyTorch: ID={char_id_pt:03d} (Char='{char_pt_str}', Prob={prob_pt:.4f}) | ONNX: ID={char_id_onnx:03d} (Char='{char_onnx_str}', Prob={prob_onnx:.4f})")
            
            translated_pt.append(char_id_pt)
            translated_onnx.append(char_id_onnx)
            
            if char_id_pt == 2 and char_id_onnx == 2:
                break

if __name__ == '__main__':
    main()
