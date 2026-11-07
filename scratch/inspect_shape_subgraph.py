import onnx

def trace_producers(graph, tensor_name, visited=None):
    if visited is None:
        visited = set()
    if tensor_name in visited:
        return
    visited.add(tensor_name)
    
    # Find producer node
    producer = [node for node in graph.node if tensor_name in node.output]
    if not producer:
        # Check if it's an initializer (constant)
        init = [i for i in graph.initializer if i.name == tensor_name]
        if init:
            print(f"Constant '{tensor_name}': shape={init[0].dims}")
        else:
            print(f"Input/Unknown '{tensor_name}'")
        return
        
    node = producer[0]
    print(f"Node '{tensor_name}': op_type={node.op_type}, inputs={node.input}")
    for inp in node.input:
        trace_producers(graph, inp, visited)

def main():
    model = onnx.load('public/models/vietocr_cnn.onnx')
    print("Tracing producers of 'val_110'...")
    trace_producers(model.graph, 'val_110')

if __name__ == '__main__':
    main()
