import inspect
from vietocr.tool.translate import translate

def main():
    print(inspect.getsource(translate))

if __name__ == '__main__':
    main()
