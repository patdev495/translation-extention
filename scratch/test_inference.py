import onnxruntime as ort
import numpy as np
import os

def main():
    print("Loading models...")
    cnn = ort.InferenceSession('public/models/vietocr_cnn.onnx')
    encoder = ort.InferenceSession('public/models/vietocr_encoder.onnx')
    decoder = ort.InferenceSession('public/models/vietocr_decoder.onnx')
    
    # Load vocabulary
    with open('public/models/vietocr_dict.txt', 'r', encoding='utf-8') as f:
        vocab = [line.strip('\r\n') for line in f]
        
    print(f"Vocab size: {len(vocab)}")
    
    # Generate dummy image: height 32, width 448
    # Let's see if we can get anything out
    img = np.random.rand(1, 3, 32, 448).astype(np.float32)
    
    print("Running CNN...")
    src = cnn.run(None, {'img': img})[0]
    print(f"CNN output shape: {src.shape}")
    
    print("Running Encoder...")
    encoder_outputs, hidden = encoder.run(None, {'src': src})
    print(f"Encoder outputs shape: {encoder_outputs.shape}, Hidden shape: {hidden.shape}")
    
    sos_token = 1
    eos_token = 2
    translated_sentence = [sos_token]
    max_seq_length = 128
    maxLength = 0
    
    print("Running Decoder loop...")
    while maxLength <= max_seq_length:
        tgt_in = np.array([translated_sentence[-1]], dtype=np.int64)
        
        # Run Decoder
        output, hidden_out, last = decoder.run(None, {
            'tgt': tgt_in,
            'hidden': hidden,
            'encoder_outputs': encoder_outputs
        })
        
        hidden = hidden_out
        
        # Get index with max value
        max_idx = int(np.argmax(output[0]))
        if max_idx == eos_token:
            print(f"EOS reached at step {maxLength}")
            break
            
        translated_sentence.append(max_idx)
        maxLength += 1
        
    print(f"Indices predicted: {translated_sentence}")
    
    # Decode
    decoded = []
    for idx in translated_sentence[1:]:
        if idx < 4:
            continue
        decoded.append(vocab[idx - 4])
    print("Decoded string:", "".join(decoded))

if __name__ == '__main__':
    main()
