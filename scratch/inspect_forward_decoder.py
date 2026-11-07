import inspect
from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    model, vocab = build_model(config)
    
    print("forward_decoder source:")
    print(inspect.getsource(model.transformer.forward_decoder))

if __name__ == '__main__':
    main()
