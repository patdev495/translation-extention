import inspect
import vietocr.tool.translate as translate

def main():
    print("--- resize ---")
    print(inspect.getsource(translate.resize))

if __name__ == '__main__':
    main()
