#!/usr/bin/env python
# coding: utf-8
# =============================================================================
# Sigma Jupyter Widget
# =============================================================================
#
#
from ipywidgets import DOMWidget
from traitlets import Unicode, Dict, Int, Bool
import networkx as nx
from ._frontend import module_name, module_version

# =============================================================================
# Constants
# =============================================================================
MULTI_GRAPHS = (nx.MultiGraph, nx.MultiDiGraph)
DIRECTED_GRAPHS = (nx.DiGraph, nx.MultiDiGraph)


# =============================================================================
# Helpers
# =============================================================================
def pretty_print_int(v):
    return '{:,}'.format(int(v))


def extract_rgba_from_viz(viz_color):
    if 'a' in viz_color:
        return 'rgba(%s, %s, %s, %s)' % (
            viz_color['r'],
            viz_color['g'],
            viz_color['b'],
            viz_color['a'],
        )

    return 'rgba(%s, %s, %s)' % (
            viz_color['r'],
            viz_color['g'],
            viz_color['b'],
        )


# =============================================================================
# Widget definition
# =============================================================================
class Sigma(DOMWidget):
    _model_name = Unicode('SigmaModel').tag(sync=True)
    _model_module = Unicode(module_name).tag(sync=True)
    _model_module_version = Unicode(module_version).tag(sync=True)
    _view_name = Unicode('SigmaView').tag(sync=True)
    _view_module = Unicode(module_name).tag(sync=True)
    _view_module_version = Unicode(module_version).tag(sync=True)

    data = Dict({'nodes': [], 'edges': []}).tag(sync=True)
    height = Int(500).tag(sync=True)
    start_layout = Bool(False).tag(sync=True)
    snapshot = Unicode(allow_none=True).tag(sync=True)

    def __init__(self, graph, height=500, start_layout=False, **kwargs):
        super(Sigma, self).__init__(**kwargs)

        self.graph = graph

        is_directed = isinstance(graph, DIRECTED_GRAPHS)

        # Serializing graph as per graphology's JSON format
        nodes = []

        for node, attr in graph.nodes(data=True):
            nodes.append({
                'key': node,
                'attributes': attr
            })

        edges = []

        for source, target, attr in graph.edges(data=True):
            edges.append({
                'source': source,
                'target': target,
                'attributes': attr,
                'undirected': not is_directed
            })

        self.data = {
            'nodes': nodes,
            'edges': edges,
            'options': {
                'type': 'directed' if is_directed else 'undirected',
                'multi': isinstance(graph, MULTI_GRAPHS),
            }
        }

        self.height = height
        self.start_layout = start_layout
        self.snapshot = None

    def __repr__(self):
        return 'Sigma(nx.%s with %s nodes and %s edges)' % (
            self.graph.__class__.__name__,
            pretty_print_int(self.graph.order()),
            pretty_print_int(self.graph.size())
        )

    @staticmethod
    def from_gexf(path_or_file, *args, **kwargs):
        g = nx.read_gexf(path_or_file)

        # Mangling nodes
        for _, attr in g.nodes(data=True):
            if 'viz' not in attr:
                continue

            viz = attr['viz']

            # Size
            if 'size' in viz:
                attr['size'] = viz['size']

            # Position
            if 'position' in viz:
                pos = viz['position']

                if 'x' in pos:
                    attr['x'] = pos['x']

                if 'y' in pos:
                    attr['y'] = pos['y']

            # Color
            if 'color' in viz:
                attr['color'] = extract_rgba_from_viz(viz['color'])

        # Mangling edges
        for _, _, attr in g.edges(data=True):
            if 'viz' not in attr:
                continue

            viz = attr['viz']

            # Thickness
            if 'thickness' in viz:
                attr['size'] = viz['thickness']

            # Color
            if 'color' in viz:
                attr['color'] = extract_rgba_from_viz(viz['color'])

        return Sigma(g, *args, **kwargs)
