import onnxruntime as ort

def check_model(path):
    print(f"=== {path} ===")
    session = ort.InferenceSession(path)
    print("Inputs:")
    for i in session.get_inputs():
        print(f"  Name: {i.name}, Shape: {i.shape}, Type: {i.type}")
    print("Outputs:")
    for o in session.get_outputs():
        print(f"  Name: {o.name}, Shape: {o.shape}, Type: {o.type}")

def main():
    check_model('public/models/vietocr_cnn.onnx')
    check_model('public/models/vietocr_encoder.onnx')
    check_model('public/models/vietocr_decoder.onnx')

if __name__ == '__main__':
    main()
