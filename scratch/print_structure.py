from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    config['cnn']['pretrained'] = False
    model, vocab = build_model(config)
    print("Model class:", model.__class__.__name__)
    print("Model modules:")
    for name, module in model.named_children():
        print(f"  {name}: {module.__class__.__name__}")
        # Print submodules of seq_modeling
        if name == 'seq_modeling':
            for sub_name, sub_module in module.named_children():
                print(f"    {sub_name}: {sub_module.__class__.__name__}")

if __name__ == '__main__':
    main()
