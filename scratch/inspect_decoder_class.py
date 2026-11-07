import inspect
from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    model, vocab = build_model(config)
    print("Decoder Class:", model.transformer.decoder.__class__)
    print("Decoder Forward Source:")
    print(inspect.getsource(model.transformer.decoder.forward))

if __name__ == '__main__':
    main()
