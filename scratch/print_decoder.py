import inspect
from vietocr.model.seqmodel.seq2seq import Decoder

def main():
    print(inspect.getsource(Decoder))

if __name__ == '__main__':
    main()
