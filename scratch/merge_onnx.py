import onnx
import os

def merge_and_save(model_path):
    print(f"Loading {model_path}...")
    model = onnx.load(model_path)
    print(f"Saving self-contained model to {model_path}...")
    onnx.save(model, model_path)
    
    # Clean up the .data file if it exists
    data_file = model_path + ".data"
    if os.path.exists(data_file):
        os.remove(data_file)
        print(f"Removed external weights file: {data_file}")

def main():
    models = [
        'public/models/vietocr_cnn.onnx',
        'public/models/vietocr_encoder.onnx',
        'public/models/vietocr_decoder.onnx'
    ]
    for m in models:
        if os.path.exists(m):
            merge_and_save(m)
    print("Merging complete!")

if __name__ == '__main__':
    main()
