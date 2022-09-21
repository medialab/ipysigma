# =============================================================================
# ipysigma Abstract Interfaces
# =============================================================================
#
# Abstract interfaces used to deal with networkx or igraph.
#
NETWORKX_INSTALLED = False
IGRAPH_INSTALLED = False

try:
    import networkx as nx

    NETWORKX_INSTALLED = True
except ImportError:
    nx = None

try:
    import igraph as ig

    IGRAPH_INSTALLED = True
except ImportError:
    ig = None


def is_networkx_graph(v):
    if not NETWORKX_INSTALLED:
        return False

    return isinstance(v, (nx.Graph, nx.DiGraph, nx.MultiGraph, nx.MultiDiGraph))


def is_igraph_graph(v):
    if not IGRAPH_INSTALLED:
        return False

    return isinstance(v, ig.GraphBase)


class IPySigmaGraphInterface(object):
    def __init__(self, graph):
        self.graph = graph

    def is_directed(self) -> bool:
        raise NotImplementedError

    def is_multi(self) -> bool:
        raise NotImplementedError


class NetworkxInterface(IPySigmaGraphInterface):
    def is_directed(self):
        return self.graph.is_directed()

    def is_multi(self):
        return self.graph.is_multigraph()


class IGraphInterface(IPySigmaGraphInterface):
    def is_directed(self):
        return self.graph.is_directed()

    def is_multi(self):
        return self.graph.has_multiple()


def get_graph_interface(graph):
    if is_networkx_graph(graph):
        return NetworkxInterface(graph)

    if is_igraph_graph(graph):
        return IGraphInterface(graph)

    raise TypeError(
        "unknown graph type. expecting either a networkx or igraph instance."
    )
