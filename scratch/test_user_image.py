from PIL import Image
Image.ANTIALIAS = Image.Resampling.LANCZOS
import numpy as np
import onnxruntime as ort
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg
import os

def run_pytorch(img_path, predictor):
    img = Image.open(img_path)
    result = predictor.predict(img)
    print("PyTorch output:", result)

def run_onnx(img_path, cnn, encoder, decoder, vocab):
    import math
    img = Image.open(img_path).convert('RGB')
    
    # Dynamic preprocessing: scale height to 32, round width to multiple of 4
    w, h = img.size
    new_w = int(32 * float(w) / float(h))
    new_w = int(math.ceil(new_w / 4.0) * 4)
    
    # Resize keeping aspect ratio
    resized_img = img.resize((new_w, 32), Image.Resampling.LANCZOS)
    
    # Convert to float and scale by 1/255
    img_np = np.asarray(resized_img).transpose(2, 0, 1).astype(np.float32)
    img_np = img_np / 255.0
    img_np = np.expand_dims(img_np, axis=0) # [1, 3, 32, new_w]
    
    # Inference
    src = cnn.run(None, {'img': img_np})[0]
    encoder_outputs, hidden = encoder.run(None, {'src': src})
    
    sos_token = 1
    eos_token = 2
    translated_sentence = [sos_token]
    max_seq_length = 128
    maxLength = 0
    
    while maxLength <= max_seq_length:
        tgt_in = np.array([translated_sentence[-1]], dtype=np.int64)
        output, hidden_out, last = decoder.run(None, {
            'tgt': tgt_in,
            'hidden': hidden,
            'encoder_outputs': encoder_outputs
        })
        hidden = hidden_out
        max_idx = int(np.argmax(output[0]))
        if max_idx == eos_token:
            break
        translated_sentence.append(max_idx)
        maxLength += 1
        
    decoded = []
    for idx in translated_sentence[1:]:
        if idx < 4:
            continue
        decoded.append(vocab[idx - 4])
    print("ONNX output:   ", "".join(decoded))

def main():
    img_path = r"C:\Users\Admin\.gemini\antigravity-ide\brain\c4b36347-1099-41d7-8139-8ad5650eddc3\media__1783410949837.png"
    
    print("Loading PyTorch model...")
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    predictor = Predictor(config)
    # Load ONNX sessions
    print("Loading ONNX models...")
    cnn = ort.InferenceSession('scratch/legacy_models/vietocr_cnn.onnx')
    encoder = ort.InferenceSession('scratch/legacy_models/vietocr_encoder.onnx')
    decoder = ort.InferenceSession('scratch/legacy_models/vietocr_decoder.onnx')
    
    with open('public/models/vietocr_dict.txt', 'r', encoding='utf-8') as f:
        vocab = [line.strip('\r\n') for line in f]
        
    print("\n--- Running on User Image ---")
    run_pytorch(img_path, predictor)
    run_onnx(img_path, cnn, encoder, decoder, vocab)

if __name__ == '__main__':
    main()
