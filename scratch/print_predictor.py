import inspect
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg

def main():
    print(inspect.getsource(Predictor.__init__))

if __name__ == '__main__':
    main()
