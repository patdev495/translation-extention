import onnx
from onnx import numpy_helper

def main():
    model = onnx.load('public/models/vietocr_cnn.onnx')
    graph = model.graph
    
    # Print initializer values
    initializers = {init.name: init for init in graph.initializer}
    
    for name in ['val_2', 'val_106', 'val_107', 'val_108']:
        if name in initializers:
            init = initializers[name]
            val = numpy_helper.to_array(init)
            print(f"Initializer '{name}': value={val}, dtype={val.dtype}, shape={val.shape}")
            
    # Find Reshape Node 1 (floordiv shape)
    reshape_nodes = [node for node in graph.node if node.op_type == 'Reshape']
    for node in reshape_nodes:
        if 'floordiv' in node.input:
            print("\nReshape Node:")
            print("  Inputs:", node.input)
            print("  Outputs:", node.output)

if __name__ == '__main__':
    main()
