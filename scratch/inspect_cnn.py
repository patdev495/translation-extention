from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model
import inspect

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    model, vocab = build_model(config)
    
    print("--- CNN class ---")
    print(inspect.getsource(model.cnn.__class__))
    
    print("\n--- CNN.forward source ---")
    print(inspect.getsource(model.cnn.forward))

if __name__ == '__main__':
    main()
