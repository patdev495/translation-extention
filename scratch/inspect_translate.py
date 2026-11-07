import inspect
import vietocr.tool.translate as translate

def main():
    print("--- process_input ---")
    print(inspect.getsource(translate.process_input))
    
    print("\n--- translate ---")
    print(inspect.getsource(translate.translate))
    
    print("\n--- translate_beam_search ---")
    try:
        print(inspect.getsource(translate.translate_beam_search))
    except Exception as e:
        print(e)

if __name__ == '__main__':
    main()
