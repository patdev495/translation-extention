import inspect
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    predictor = Predictor(config)
    
    print("--- Predictor.predict source ---")
    print(inspect.getsource(predictor.predict))
    
    # Let's see if there is a helper class/method for preprocessing
    print("\n--- Inspecting Predictor fields ---")
    for name, attr in inspect.getmembers(predictor):
        if not name.startswith('_') and not inspect.ismethod(attr):
            print(f"Field: {name} = {type(attr)}")
            
if __name__ == '__main__':
    main()
