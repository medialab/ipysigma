from ipywidgets import DOMWidget, register
from traitlets import Dict, Unicode

@register
class Sigma(DOMWidget):
    """An example widget."""
    _view_name = Unicode('SigmaView').tag(sync=True)
    _model_name = Unicode('SigmaModel').tag(sync=True)
    _view_module = Unicode('ipysigma').tag(sync=True)
    _model_module = Unicode('ipysigma').tag(sync=True)
    _view_module_version = Unicode('^0.1.0').tag(sync=True)
    _model_module_version = Unicode('^0.1.0').tag(sync=True)
    value = Dict({'nodes': [], 'edges': [], 'directed': False}).tag(sync=True)

    def __init__(self, g, **kwargs):
        super(Sigma, self).__init__(**kwargs)

        nodes = list(g.nodes(data=True))
        edges = list(g.edges(data=True))

        self.value = {
            'nodes': nodes,
            'edges': edges,
            'directed': g.is_directed()
        }
