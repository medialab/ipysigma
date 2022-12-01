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
    return NETWORKX_INSTALLED and isinstance(
        v, (nx.Graph, nx.DiGraph, nx.MultiGraph, nx.MultiDiGraph)
    )


def is_igraph_graph(v):
    return IGRAPH_INSTALLED and isinstance(v, ig.GraphBase)


def is_valid_graph(v):
    return is_networkx_graph(v) or is_igraph_graph(v)


def check_graph_is_valid(v):
    if not is_valid_graph(v):
        raise TypeError("graph should be a networkx or igraph instance")


class IPySigmaGraphInterface(object):
    def __init__(self, graph):
        self.graph = graph

    def name(self):
        raise NotImplementedError

    def is_directed(self) -> bool:
        raise NotImplementedError

    def is_multi(self) -> bool:
        raise NotImplementedError

    def nodes(self):
        raise NotImplementedError

    def edges(self):
        raise NotImplementedError

    def order(self) -> int:
        raise NotImplementedError

    def size(self) -> int:
        raise NotImplementedError

    def has_edge(self, a, b) -> bool:
        raise NotImplementedError


class NetworkxInterface(IPySigmaGraphInterface):
    def name(self):
        return "nx." + self.graph.__class__.__name__

    def is_directed(self):
        return self.graph.is_directed()

    def is_multi(self):
        return self.graph.is_multigraph()

    def nodes(self):
        yield from self.graph.nodes.data()

    def edges(self):
        yield from self.graph.edges.data()

    def order(self):
        return self.graph.order()

    def size(self):
        return self.graph.size()

    def has_edge(self, a, b):
        return self.graph.has_edge(a, b)


class IGraphInterface(IPySigmaGraphInterface):
    def name(self):
        return "ig." + self.graph.__class__.__name__

    def is_directed(self):
        return self.graph.is_directed()

    def is_multi(self):
        return self.graph.has_multiple()

    def nodes(self):
        for i, v in enumerate(self.graph.vs):
            yield i, v.attributes()

    def edges(self):
        for e in self.graph.es:
            yield e.source, e.target, e.attributes()

    def order(self):
        return self.graph.vcount()

    def size(self):
        return self.graph.ecount()

    def has_edge(self, a, b):
        return self.graph.are_connected(a, b)


def get_graph_interface(graph):
    if is_networkx_graph(graph):
        return NetworkxInterface(graph)

    if is_igraph_graph(graph):
        return IGraphInterface(graph)

    raise TypeError(
        "unknown graph type. expecting either a networkx or igraph instance."
    )


def is_networkx_degree_view(target) -> bool:
    if not NETWORKX_INSTALLED:
        return False

    return isinstance(
        target,
        (
            nx.classes.reportviews.DegreeView,
            nx.classes.reportviews.DiDegreeView,
            nx.classes.reportviews.InDegreeView,
            nx.classes.reportviews.OutDegreeView,
            nx.classes.reportviews.MultiDegreeView,
            nx.classes.reportviews.DiMultiDegreeView,
            nx.classes.reportviews.InMultiDegreeView,
            nx.classes.reportviews.OutMultiDegreeView,
        ),
    )
