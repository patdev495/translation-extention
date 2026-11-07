import inspect
from vietocr.tool.predictor import process_image

def main():
    print("--- process_image source ---")
    print(inspect.getsource(process_image))
            
if __name__ == '__main__':
    main()
