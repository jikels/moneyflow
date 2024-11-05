import networkx as nx
from pyvis.network import Network
import json
from datetime import datetime

class TransactionGraph:
    def __init__(self, data):
        self.data = data
        self.net = Network(height='750px', width='100%', directed=True, notebook=False)

    def create_graph(self):
        print("Creating graph...")
        
        # Data is already grouped when passed in
        G = nx.from_pandas_edgelist(
            self.data, 
            source='From Label', 
            target='To Label', 
            edge_attr='Amount in Euro', 
            create_using=nx.DiGraph()
        )
        self.net.from_nx(G)

    def customize_graph(self, display_amounts, proportional_edges):
        print(f"Customizing graph, display_amounts: {display_amounts}, proportional_edges: {proportional_edges}")
        for node in self.net.nodes:
            # Add a line break between Sender and Account in the title
            sender, account = self.split_label(node['id'])

            node['title'] = node['id']
            node['label'] = f"{sender}\n({account})" if (sender and account) else node['id']
            node['shape'] = 'dot'
            node['image'] = ''

        for edge in self.net.edges:
            if display_amounts:
                edge['label'] = f"€{edge['Amount in Euro']:,.2f}"
            if proportional_edges:
                edge['value'] = float(edge['Amount in Euro'])
            amount = edge.get('Amount in Euro', 0)
            formatted_amount = f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            edge['title'] = f"Total Amount: {formatted_amount} EUR"
            
            if proportional_edges:
                edge['value'] = amount
            else:
                edge['value'] = 1  # Set a uniform value for all edges
            
            if display_amounts:
                edge['label'] = f"{formatted_amount} EUR"

    def toggle_physics(self, enable_physics):
        if not enable_physics:
            # Save current node positions when disabling physics
            for node in self.net.nodes:
                if 'x' not in node or 'y' not in node:
                    node['x'] = None
                    node['y'] = None
        self.net.toggle_physics(enable_physics)

    def get_graph_data(self):
        print("Getting graph data...")
        return {
            "nodes": [{
                "id": node["id"], 
                "label": node["label"], 
                "title": node["title"],
                "shape": node.get("shape", "dot"),
                "image": node.get("image", ""),
                "x": node.get("x"),
                "y": node.get("y")
            } for node in self.net.nodes],
            "edges": [{
                "from": edge["from"], 
                "to": edge["to"], 
                "label": edge.get("label", ""), 
                "title": edge["title"], 
                "value": edge["value"]
            } for edge in self.net.edges]
        }

    def save_graph_state(self, file_path, filters):
        graph_state = {
            "nodes": self.net.nodes,
            "edges": self.net.edges,
            "filters": filters
        }
        with open(file_path, 'w') as f:
            json.dump(graph_state, f)

    def load_graph_state(self, file_path):
        with open(file_path, 'r') as f:
            graph_state = json.load(f)
        
        filters = {
            k: (datetime.fromisoformat(v) if isinstance(v, str) and self._is_iso_date(v) else v)
            for k, v in graph_state["filters"].items()
        }

        self.net.nodes = graph_state["nodes"]
        self.net.edges = graph_state["edges"]
        return filters

    @staticmethod
    def _is_iso_date(string):
        try:
            datetime.fromisoformat(string)
            return True
        except ValueError:
            return False

    @staticmethod
    def split_label(label):
        if '(' in label and ')' in label:
            sender, account = label.rsplit('(', 1)
            sender = sender.strip()
            account = account.rstrip(')')
        else:
            sender = label
            account = ''
        return sender, account

    def generate_html(self, file_path):
        self.net.show(file_path)
