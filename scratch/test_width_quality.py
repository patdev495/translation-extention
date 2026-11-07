import torch
from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model
from PIL import Image
Image.ANTIALIAS = Image.Resampling.LANCZOS
import numpy as np

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    
    from vietocr.tool.predictor import Predictor
    predictor = Predictor(config)
    model = predictor.model
    model.eval()
    
    img_path = 'C:/Users/Admin/.gemini/antigravity-ide/brain/c4b36347-1099-41d7-8139-8ad5650eddc3/media__1783410949837.png'
    user_img = Image.open(img_path).convert('RGB')
    w, h = user_img.size
    
    # Try different widths
    widths = [600, 604, 608, 610, 612, 616, 620, 624]
    
    import vietocr.tool.translate as translate_module
    
    print("--- Testing Different Widths on User Image ---")
    for width in widths:
        # Resize to (width, 32)
        resized = user_img.resize((width, 32), Image.Resampling.LANCZOS)
        img_np = np.array(resized, dtype=np.float32).transpose(2, 0, 1) / 255.0
        img_np = np.expand_dims(img_np, axis=0)
        img_torch = torch.FloatTensor(img_np)
        
        # Predict
        with torch.no_grad():
            s, prob = translate_module.translate(img_torch, model)
            # Decode indices
            s_list = s[0].tolist()
            decoded = predictor.vocab.decode(s_list)
            print(f"Width: {width:3d} (divisible by 4: {width % 4 == 0}) | Prediction: {decoded}")

if __name__ == '__main__':
    main()
