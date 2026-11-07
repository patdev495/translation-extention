import inspect
import vietocr.tool.translate as trans

def main():
    print("--- process_input source ---")
    print(inspect.getsource(trans.process_input))
    
    print("\n--- process_image source ---")
    print(inspect.getsource(trans.process_image))
            
if __name__ == '__main__':
    main()
