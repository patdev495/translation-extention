import onnx

def main():
    model_path = 'public/models/vietocr_cnn.onnx'
    model = onnx.load(model_path)
    graph = model.graph
    
    # Find Reshape node
    reshape_nodes = [node for node in graph.node if node.op_type == 'Reshape']
    print(f"Found {len(reshape_nodes)} Reshape nodes:")
    
    for i, node in enumerate(reshape_nodes):
        print(f"\nReshape Node {i+1}:")
        print("  Inputs:", node.input)
        print("  Outputs:", node.output)
        
        # Let's find the nodes that produce the shape input
        shape_input_name = node.input[1]
        print(f"  Shape Input Name: {shape_input_name}")
        
        # Trace back the shape input
        producer = [n for n in graph.node if shape_input_name in n.output]
        if producer:
            print("  Producer Node:")
            print(f"    Op Type: {producer[0].op_type}")
            print(f"    Inputs: {producer[0].input}")
            print(f"    Outputs: {producer[0].output}")
            
if __name__ == '__main__':
    main()
