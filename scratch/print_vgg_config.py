from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    print("ss:", config['cnn']['ss'])
    print("ks:", config['cnn']['ks'])

if __name__ == '__main__':
    main()
