#!/usr/bin/env python
# coding: utf-8

# Copyright (c) Yomguithereal.
# Distributed under the terms of the Modified BSD License.

"""
TODO: Add module docstring
"""

from ipywidgets import DOMWidget
from traitlets import Unicode, Dict, Int, Bool
import networkx as nx
from ._frontend import module_name, module_version

MULTI_GRAPHS = (nx.MultiGraph, nx.MultiDiGraph)
DIRECTED_GRAPHS = (nx.DiGraph, nx.MultiDiGraph)


class Sigma(DOMWidget):
    """TODO: Add docstring here
    """
    _model_name = Unicode('SigmaModel').tag(sync=True)
    _model_module = Unicode(module_name).tag(sync=True)
    _model_module_version = Unicode(module_version).tag(sync=True)
    _view_name = Unicode('SigmaView').tag(sync=True)
    _view_module = Unicode(module_name).tag(sync=True)
    _view_module_version = Unicode(module_version).tag(sync=True)

    data = Dict({'nodes': [], 'edges': []}).tag(sync=True)
    height = Int(500).tag(sync=True)
    start_layout = Bool(False).tag(sync=True)

    def __init__(self, graph, height=500, start_layout=False, **kwargs):
        super(Sigma, self).__init__(**kwargs)

        nodes = []

        for node, attr in graph.nodes(data=True):
            nodes.append({
                'key': node,
                'attributes': attr
            })

        self.data = {
            'nodes': nodes,
            'edges': [],
            'settings': {
                'type': 'directed' if isinstance(graph, DIRECTED_GRAPHS) else 'undirected',
                'multi': isinstance(graph, MULTI_GRAPHS),
            }
        }

        self.height = height
        self.start_layout = start_layout
