from vietocr.tool.config import Cfg
from vietocr.tool.predictor import Predictor

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    predictor = Predictor(config)
    print("Predictor beamsearch config:", predictor.config.get('predictor', {}).get('beamsearch', None))
    
    # Let's inspect the code of predictor.predict or translate
    import inspect
    print("\nPredictor.predict_inline source:")
    print(inspect.getsource(predictor.predict_inline))

if __name__ == '__main__':
    main()
