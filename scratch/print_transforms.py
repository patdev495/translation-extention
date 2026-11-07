from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    config['cnn']['pretrained'] = False
    # Avoid downloading weights by passing pretrained=False
    predictor = Predictor(config)
    print("Transformer in predictor:")
    # Check predictor properties
    print(dir(predictor))
    # Predictor class usually has a preprocess or transform method or property
    # Let's inspect it
    import inspect
    if hasattr(predictor, 'transform'):
        print("transform:", predictor.transform)
    else:
        # Check predict method source code
        print(inspect.getsource(predictor.predict))

if __name__ == '__main__':
    main()
