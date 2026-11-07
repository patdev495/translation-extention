import inspect
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    predictor = Predictor(config)
    
    print("Predictor.predict source:")
    print(inspect.getsource(predictor.predict))

if __name__ == '__main__':
    main()
