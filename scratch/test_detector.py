import onnxruntime as ort
import numpy as np
from PIL import Image
import cv2
import os

def calculate_resize_dimensions(w, h, max_side_len=640):
    if w > h:
        ratio = float(max_side_len) / float(w)
    else:
        ratio = float(max_side_len) / float(h)
    return int(w * ratio), int(h * ratio), ratio

def main():
    img_path = r"C:\Users\Admin\.gemini\antigravity-ide\brain\c4b36347-1099-41d7-8139-8ad5650eddc3\media__1783410620379.png"
    model_path = r"public/models/PP-OCRv6_small_det.ort"
    
    print("Loading detector model...")
    # Use CPU provider
    session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    
    print("Loading image...")
    img = Image.open(img_path).convert('RGB')
    w, h = img.size
    print(f"Original size: {w}x{h}")
    
    # Preprocess
    resize_w, resize_h, ratio = calculate_resize_dimensions(w, h, 640)
    # Pad to multiples of 32
    pad_w = int(np.ceil(resize_w / 32.0) * 32)
    pad_h = int(np.ceil(resize_h / 32.0) * 32)
    print(f"Padded size: {pad_w}x{pad_h}, ratio: {ratio}")
    
    # Resize and pad
    resized_img = img.resize((resize_w, resize_h), Image.Resampling.LANCZOS)
    padded_img = Image.new('RGB', (pad_w, pad_h), (0, 0, 0))
    padded_img.paste(resized_img, (0, 0))
    
    # Normalize (mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    img_np = np.asarray(padded_img).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_np = (img_np - mean) / std
    img_np = img_np.transpose(2, 0, 1) # [C, H, W]
    img_np = np.expand_dims(img_np, axis=0) # [1, C, H, W]
    
    # Run inference
    print("Running detector inference...")
    outputs = session.run(None, {'x': img_np})
    prob_map = outputs[0][0, 0] # [H, W] probability map
    
    # Postprocess (threshold at 0.3 or binarize)
    # The output map is the probability of text pixels.
    # In JS: threshold(127) on the probability map scaled to 0-255.
    prob_map_uint8 = (prob_map * 255).astype(np.uint8)
    _, thresh = cv2.threshold(prob_map_uint8, 127, 255, cv2.THRESH_BINARY)
    
    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    boxes = []
    for contour in contours:
        # Get bounding rect
        x, y, w_box, h_box = cv2.boundingRect(contour)
        
        # Scale back to original coordinates
        orig_x = int(x / ratio)
        orig_y = int(y / ratio)
        orig_w = int(w_box / ratio)
        orig_h = int(h_box / ratio)
        
        # Filter tiny boxes
        if w_box * h_box < 50:
            continue
            
        boxes.append({
            'x': orig_x,
            'y': orig_y,
            'w': orig_w,
            'h': orig_h,
            'area_padded': w_box * h_box
        })
        
    print(f"Found {len(boxes)} boxes:")
    for i, box in enumerate(boxes):
        print(f"  Box {i+1}: x={box['x']}, y={box['y']}, w={box['w']}, h={box['h']} (area_padded={box['area_padded']})")

if __name__ == '__main__':
    main()
