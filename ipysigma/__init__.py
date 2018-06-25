from ._version import version_info, __version__

from .sigma import *

def _jupyter_nbextension_paths():
    return [{
        'section': 'notebook',
        'src': 'static',
        'dest': 'ipysigma',
        'require': 'ipysigma/extension'
    }]
