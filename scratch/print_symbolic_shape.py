import torch
from vietocr.tool.config import Cfg
from vietocr.tool.translate import build_model

def main():
    config = Cfg.load_config_from_name('vgg_seq2seq')
    config['device'] = 'cpu'
    model, vocab = build_model(config)
    model.eval()
    
    img = torch.rand(1, 3, 32, 448)
    width_dim = torch.export.Dim("width")
    
    # Run export and inspect the output shape of CNN
    ep = torch.export.export(
        model.cnn,
        (img,),
        dynamic_shapes={"x": {3: width_dim}}
    )
    print("Exported program output shape:", ep.module().forward(img).shape)
    print("Symbolic output shape:", ep.graph_signature.output_specs)
    
if __name__ == '__main__':
    main()
