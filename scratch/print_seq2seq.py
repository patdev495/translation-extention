import inspect
from vietocr.model.seqmodel.seq2seq import Seq2Seq

def main():
    print(inspect.getsource(Seq2Seq))

if __name__ == '__main__':
    main()
