import inspect
import vietocr.tool.translate as trans

def main():
    print("--- resize source ---")
    print(inspect.getsource(trans.resize))
            
if __name__ == '__main__':
    main()
