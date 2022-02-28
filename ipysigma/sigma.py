#!/usr/bin/env python
# coding: utf-8
# =============================================================================
# Sigma Jupyter Widget
# =============================================================================
#
#
from ipywidgets import DOMWidget, HTML
from traitlets import Unicode, Dict, Int, Bool
import networkx as nx
from ._frontend import module_name, module_version

# =============================================================================
# Constants
# =============================================================================
MULTI_GRAPHS = (nx.MultiGraph, nx.MultiDiGraph)
DIRECTED_GRAPHS = (nx.DiGraph, nx.MultiDiGraph)
DEFAULT_NODE_SIZE_RANGE = (2, 12)


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
    """
    Jupyter widget displaying an interactive interface that can be used to
    explore the given networkx graph using sigma.js.

    Args:
        graph (nx.Graph or nx.DiGraph or nx.MultiGraph or nx.MultiDiGraph):
            networkx graph to explore.
        height (int, optional): height of the widget in pixels. Cannot be less
            than 250px. Defaults to 500.
        start_layout (bool, optional): whether to automatically start the
            provided ForceAtlas2 layout when the widget is displayed.
            Defaults to False.
        node_color (str, optional): name of the node attribute that should
            be interpreted as a category to be used for node color. Note that
            a suitable color palette will be automatically generated for you.
            Defaults to None.
        node_size (str, optional): name of the node attribute that should be
            used for node size. Note the provided size is scaled using
            the range provided by the `node_size_range` kwarg.
            Defaults to "size".
        node_size_range ((number, number), optional): range for node size
            interpolation. Defaults to (2, 12).
        node_label: name of the node attribute that will be used as node
            label. Defaults to "label".
    """

    _model_name = Unicode('SigmaModel').tag(sync=True)
    _model_module = Unicode(module_name).tag(sync=True)
    _model_module_version = Unicode(module_version).tag(sync=True)
    _view_name = Unicode('SigmaView').tag(sync=True)
    _view_module = Unicode(module_name).tag(sync=True)
    _view_module_version = Unicode(module_version).tag(sync=True)

    singleton_lock = Bool(False).tag(sync=True)
    data = Dict({'nodes': [], 'edges': []}).tag(sync=True)
    height = Int(500).tag(sync=True)
    start_layout = Bool(False).tag(sync=True)
    snapshot = Unicode(allow_none=True).tag(sync=True)
    layout = Dict(allow_none=True).tag(sync=True)
    visual_variables = Dict({
        'node_label': {
            'type': 'raw',
            'attribute': 'label'
        },
        'node_color': {
            'type': 'raw',
            'attribute': 'color'
        },
        'node_size': {
            'type': 'continuous',
            'attribute': 'size',
            'range': DEFAULT_NODE_SIZE_RANGE
        }
    }).tag(sync=True)

    def __init__(self, graph, height=500, start_layout=False, node_color=None,
                 node_size='size', node_size_range=DEFAULT_NODE_SIZE_RANGE,
                 node_label='label', **kwargs):
        super(Sigma, self).__init__(**kwargs)

        if height < 250:
            raise TypeError('Sigma widget cannot have a height < 250 px')

        # Own
        self.graph = graph

        # Traits
        self.height = height
        self.start_layout = start_layout
        self.snapshot = None
        self.layout = None

        is_directed = isinstance(graph, DIRECTED_GRAPHS)

        # Serializing visual variables
        visual_variables = self.visual_variables.copy()

        if node_color is not None:
            visual_variables['node_color'] = {
                'type': 'category',
                'attribute': node_color
            }

        if node_size is not None:
            visual_variables['node_size'] = {
                'type': 'continuous',
                'attribute': node_size,
                'range': node_size_range
            }

        if node_label is not None:
            visual_variables['node_label'] = {
                'type': 'raw',
                'attribute': node_label
            }

        self.visual_variables = visual_variables

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

    def __repr__(self):
        return 'Sigma(nx.%s with %s nodes and %s edges)' % (
            self.graph.__class__.__name__,
            pretty_print_int(self.graph.order()),
            pretty_print_int(self.graph.size())
        )

    def retrieve_layout(self):
        """
        Method returning the layout computed by ForceAtlas2 in the widget.

        Note that if the layout was never displayed, this method will return None.

        Also note that if you never ran the layout this method will return the
        initial layout that will be random in the [0, 1) range if you did not
        provide starting positions yourself.

        Returns:
            dict: a dictionary mapping node keys to {x, y} positions.
        """
        return self.layout

    def persist_layout(self):
        """
        Method applying the layout computed by ForceAtlas2 in the widget to
        the networkx graph passed as input to the widget.

        Note that it therefores mutates the networkx graph.

        Note that this method will raise an error if the widget was never displayed.
        """

        if self.layout is None:
            raise TypeError('Widget did not compute any layout yet. Are you sure you displayed it?')

        for node, attr in self.graph.nodes(data=True):
            pos = self.layout[node]
            attr['x'] = pos['x']
            attr['y'] = pos['y']

    def render_snasphot(self):
        """
        Method rendering and displaying a snasphot of the widget.

        This can be useful to save a version of the widget that can actually
        be seen in a static rendition of your notebook (when using nbconvert,
        for instance, or when reading the notebook on GitHub).

        Returns:
            Ipython.display.HTML: the snasphot as a data url in an img tag.
        """

        if not self.singleton_lock:
            raise TypeError('Widget needs to be displayed on screen to render a snapshot. Maybe you reinstantiated it and forgot to display the new instance?')

        self.snapshot = None

        html = HTML('<i>rendering snapshot...</i>')

        def update(change):
            html.value = '<img src="{}" style="max-width: 100%; height: auto; border: 1px solid #e0e0e0;">'.format(change.new)
            self.unobserve(update, 'snapshot')

        self.observe(update, 'snapshot')
        self.send({'msg': 'render_snapshot'})

        return html

    @staticmethod
    def from_gexf(path_or_file, *args, **kwargs):
        """
        Function returning a Sigma widget directly from a gexf file.

        This function reads the gexf file using nx.read_graph then processes
        its data to conform to the format the widget expects regarding
        visualisation information.

        Args:
            path_or_file (str or Path or buffer): path or file buffer of target
                gexf file.
            **kwargs: any kwarg that you can pass to ipysigma.Sigma.

        Returns:
            Sigma: a Sigma widget.
        """

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

            del attr['viz']

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

            del attr['viz']

        return Sigma(g, *args, **kwargs)
