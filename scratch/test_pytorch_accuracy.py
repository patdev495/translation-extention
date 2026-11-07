from PIL import Image, ImageDraw, ImageFont
Image.ANTIALIAS = Image.Resampling.LANCZOS
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg
import os

def test_text(draw_text_str, predictor, font):
    # Create white image of 448x32
    img = Image.new('RGB', (448, 32), color='white')
    draw = ImageDraw.Draw(img)
    draw.text((10, 2), draw_text_str, fill='black', font=font)
    
    # Run PyTorch predictor
    result = predictor.predict(img)
    print(f"Input: {draw_text_str} -> PyTorch: {result}")

def main():
    print("Loading PyTorch model...")
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    predictor = Predictor(config)
    
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
        test_text(t, predictor, font)

if __name__ == '__main__':
    main()
