import vietocr
import os
import inspect

def search_def(module, name):
    for k, v in inspect.getmembers(module):
        if k == name:
            print(f"Found {name} in {module}: {type(v)}")
            print(inspect.getsource(v))
            return True
        if inspect.ismodule(v) and v.__name__.startswith("vietocr"):
            if search_def(v, name):
                return True
    return False

def main():
    # Let's inspect the directory where vietocr is installed
    import vietocr.tool.predictor as pred
    print("Predictor file path:", pred.__file__)
    
    # Read the top of the file to see imports
    with open(pred.__file__, 'r') as f:
        lines = f.readlines()
        for i in range(min(50, len(lines))):
            print(lines[i], end="")
            
if __name__ == '__main__':
    main()
