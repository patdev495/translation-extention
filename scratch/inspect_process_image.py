import inspect
import vietocr.tool.translate as translate

def main():
    print("--- process_image ---")
    print(inspect.getsource(translate.process_image))

if __name__ == '__main__':
    main()
