from PIL import Image, ImageDraw, ImageFont
import numpy as np
import onnxruntime as ort
import os

def test_text(draw_text_str, cnn, encoder, decoder, vocab, font):
    # Create white image of 448x32
    img = Image.new('RGB', (448, 32), color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw text
    draw.text((10, 2), draw_text_str, fill='black', font=font)
    
    # Preprocess (divide by 255)
    img_np = np.asarray(img).transpose(2, 0, 1).astype(np.float32)
    img_np = img_np / 255.0
    img_np = np.expand_dims(img_np, axis=0) # [1, 3, 32, 448]
    
    # Run CNN
    src = cnn.run(None, {'img': img_np})[0]
    
    # Run Encoder
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
        
    # Decode
    decoded = []
    for idx in translated_sentence[1:]:
        if idx < 4:
            continue
        decoded.append(vocab[idx - 4])
        
    print(f"Input: {draw_text_str} -> OCR: {''.join(decoded)}")

def main():
    print("Loading models...")
    cnn = ort.InferenceSession('public/models/vietocr_cnn.onnx')
    encoder = ort.InferenceSession('public/models/vietocr_encoder.onnx')
    decoder = ort.InferenceSession('public/models/vietocr_decoder.onnx')
    
    with open('public/models/vietocr_dict.txt', 'r', encoding='utf-8') as f:
        vocab = [line.strip('\r\n') for line in f]
        
    font_path = "C:\\Windows\\Fonts\\arial.ttf"
    if not os.path.exists(font_path):
        font_path = "C:\\Windows\\Fonts\\segoeui.ttf"
    font = ImageFont.truetype(font_path, 20)
    
    tests = [
        "Tiếng Việt",
        "Cộng hòa xã hội chủ nghĩa",
        "Độc lập tự do",
        "Chào bạn",
        "Thử nghiệm độ chính xác",
        "Học máy giải mã ONNX"
    ]
    
    for t in tests:
        test_text(t, cnn, encoder, decoder, vocab, font)

if __name__ == '__main__':
    main()
