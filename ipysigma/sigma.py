from ipywidgets import DOMWidget, register
from traitlets import Bool, Dict, Int, Unicode

@register
class Sigma(DOMWidget):
    """
    Custom Sigma IPython widget.

    """
    _view_name = Unicode('SigmaView').tag(sync=True)
    _model_name = Unicode('SigmaModel').tag(sync=True)
    _view_module = Unicode('ipysigma').tag(sync=True)
    _model_module = Unicode('ipysigma').tag(sync=True)
    _view_module_version = Unicode('^0.1.0').tag(sync=True)
    _model_module_version = Unicode('^0.1.0').tag(sync=True)

    data = Dict({'nodes': [], 'edges': [], 'directed': False}).tag(sync=True)
    height = Int(500).tag(sync=True)
    start_layout = Bool(False).tag(sync=True)

    def __init__(self, graph, height=500, start_layout=False, **kwargs):
        super(Sigma, self).__init__(**kwargs)

        nodes = list(graph.nodes(data=True))
        edges = list(graph.edges(data=True))

        self.data = {
            'nodes': nodes,
            'edges': edges,
            'directed': graph.is_directed()
        }

        self.height = height
        self.start_layout = start_layout
