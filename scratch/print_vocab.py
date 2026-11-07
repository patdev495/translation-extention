from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    config['cnn']['pretrained'] = False
    model, vocab = build_model(config)
    print("Vocab size:", len(vocab.c2i))
    print("c2i first 15 items:", list(vocab.c2i.items())[:15])
    print("i2c first 15 items:", list(vocab.i2c.items())[:15])
    # Check if there are specific special tokens in vocab
    # usually SOS=1, EOS=2, PAD=0
    # Let's inspect c2i for special chars
    for key, val in vocab.c2i.items():
        if val < 5:
            print(f"Special: {key} -> {val}")

if __name__ == '__main__':
    main()
