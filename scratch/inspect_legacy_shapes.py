import onnx

def main():
    model = onnx.load('scratch/test_encoder_legacy.onnx')
    for inp in model.graph.input:
        shape = [dim.dim_value if dim.HasField('dim_value') else dim.dim_param for dim in inp.type.tensor_type.shape.dim]
        print(f"Input '{inp.name}': shape={shape}")
        
    for out in model.graph.output:
        shape = [dim.dim_value if dim.HasField('dim_value') else dim.dim_param for dim in out.type.tensor_type.shape.dim]
        print(f"Output '{out.name}': shape={shape}")

if __name__ == '__main__':
    main()
