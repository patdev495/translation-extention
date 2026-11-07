import inspect
import vietocr.model.backbone.vgg as vgg

def main():
    print("--- VGG class ---")
    print(inspect.getsource(vgg.Vgg))
            
if __name__ == '__main__':
    main()
