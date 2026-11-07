import inspect
from vietocr.tool.predictor import process_input

def main():
    print("--- process_input source ---")
    print(inspect.getsource(process_input))
            
if __name__ == '__main__':
    main()
