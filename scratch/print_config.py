from vietocr.tool.config import Cfg

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    print("Dataset config:")
    print(config.get('dataset'))
    print("All keys:")
    print(config.keys())

if __name__ == '__main__':
    main()
