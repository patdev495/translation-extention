import torch
from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    model, vocab = build_model(config)
    model.eval()
    
    # Test for width 608
    x = torch.rand(1, 3, 32, 608)
    with torch.no_grad():
        out = model.cnn(x)
    print("For width 608, PyTorch CNN output shape:", out.shape)
    
    # Test for width 448 (trace width)
    x2 = torch.rand(1, 3, 32, 448)
    with torch.no_grad():
        out2 = model.cnn(x2)
    print("For width 448, PyTorch CNN output shape:", out2.shape)

if __name__ == '__main__':
    main()
