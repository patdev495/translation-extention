from PIL import Image, ImageDraw, ImageFont
import numpy as np
import onnxruntime as ort
import os

def main():
    print("Creating text image...")
    # Create a white image of 448x32
    img = Image.new('RGB', (448, 32), color='white')
    draw = ImageDraw.Draw(img)
    
    # Load Segoe UI or Arial font from Windows Fonts directory
    font_path = "C:\\Windows\\Fonts\\arial.ttf"
    if not os.path.exists(font_path):
        font_path = "C:\\Windows\\Fonts\\segoeui.ttf"
        
    try:
        font = ImageFont.truetype(font_path, 20)
    except IOError:
        font = ImageFont.load_default()
        print("Using default font")
        
    # Draw black text
    draw.text((10, 2), "Xin chào", fill='black', font=font)
    
    # Save the image for visual check
    os.makedirs('scratch', exist_ok=True)
    img.save('scratch/test_line.png')
    print("Saved test_line.png")
    
    # Preprocess
    img_np = np.asarray(img).transpose(2, 0, 1).astype(np.float32)
    img_np = img_np / 255.0
    img_np = np.expand_dims(img_np, axis=0) # [1, 3, 32, 448]
    
    # Run ONNX Runtime
    print("Loading models...")
    cnn = ort.InferenceSession('public/models/vietocr_cnn.onnx')
    encoder = ort.InferenceSession('public/models/vietocr_encoder.onnx')
    decoder = ort.InferenceSession('public/models/vietocr_decoder.onnx')
    
    # Load vocabulary
    with open('public/models/vietocr_dict.txt', 'r', encoding='utf-8') as f:
        vocab = [line.strip('\r\n') for line in f]
        
    print("Running CNN...")
    src = cnn.run(None, {'img': img_np})[0]
    
    print("Running Encoder...")
    encoder_outputs, hidden = encoder.run(None, {'src': src})
    
    sos_token = 1
    eos_token = 2
    translated_sentence = [sos_token]
    max_seq_length = 128
    maxLength = 0
    
    print("Running Decoder loop...")
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
        
    print("Predicted Indices:", translated_sentence)
    print("OCR Output:", "".join(decoded))

if __name__ == '__main__':
    main()
