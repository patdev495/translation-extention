import inspect
from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    model, vocab = build_model(config)
    print("Encoder Class:", model.transformer.encoder.__class__)
    print("Encoder Forward Source:")
    print(inspect.getsource(model.transformer.encoder.forward))

if __name__ == '__main__':
    main()
