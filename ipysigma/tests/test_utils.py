import networkx as nx
import igraph as ig
from copy import deepcopy

from ipysigma.utils import is_partition, resolve_variable, sort_items_per_zindex


class TestMiscUtils(object):
    def test_is_partition(self):
        assert not is_partition({"test": 4})
        assert not is_partition([])
        assert is_partition([[0, 1], [2, 3]])
        assert is_partition([{0, 1}, {2, 3}])


class TestResolveVariable(object):
    NODES = [{"key": "one", "attributes": {}}, {"key": "two", "attributes": {}}]
    EDGES = [{"source": "one", "target": "two"}]

    def resolve_variable(self, name, target, item_type="node", is_directed=False):
        items = deepcopy(self.NODES if item_type == "node" else self.EDGES)
        attr_name = resolve_variable(
            name, items, target, item_type=item_type, is_directed=is_directed
        )
        return attr_name, items

    def test_node_attribute(self):
        name, _ = self.resolve_variable("node_color", "lang")

        assert name == "lang"

    def test_node_mapping(self):
        name, items = self.resolve_variable(
            "node_color", {"one": "blue", "two": "orange"}
        )

        assert name == "ipysigma_kwarg_node_color"
        assert items == [
            {"key": "one", "attributes": {"ipysigma_kwarg_node_color": "blue"}},
            {"key": "two", "attributes": {"ipysigma_kwarg_node_color": "orange"}},
        ]

    def test_node_vector(self):
        name, items = self.resolve_variable("node_color", ["blue", "orange"])

        assert name == "ipysigma_kwarg_node_color"
        assert items == [
            {"key": "one", "attributes": {"ipysigma_kwarg_node_color": "blue"}},
            {"key": "two", "attributes": {"ipysigma_kwarg_node_color": "orange"}},
        ]

    def test_node_partition(self):
        name, items = self.resolve_variable("node_part", [{"two"}, {"one"}])

        assert name == "ipysigma_kwarg_node_part"
        assert items == [
            {"key": "one", "attributes": {"ipysigma_kwarg_node_part": 1}},
            {"key": "two", "attributes": {"ipysigma_kwarg_node_part": 0}},
        ]

    def test_networkx_degree(self):
        g = nx.Graph()
        g.add_edge("one", "two")

        name, items = self.resolve_variable("node_size", g.degree)

        assert name == "ipysigma_kwarg_node_size"
        assert items == [
            {"key": "one", "attributes": {"ipysigma_kwarg_node_size": 1}},
            {"key": "two", "attributes": {"ipysigma_kwarg_node_size": 1}},
        ]

    def test_networkx_indegree(self):
        g = nx.DiGraph()
        g.add_edge("one", "two")

        name, items = self.resolve_variable("node_size", g.in_degree)

        assert name == "ipysigma_kwarg_node_size"
        assert items == [
            {"key": "one", "attributes": {"ipysigma_kwarg_node_size": 0}},
            {"key": "two", "attributes": {"ipysigma_kwarg_node_size": 1}},
        ]

    def test_igraph_degree(self):
        g = ig.Graph()
        g.add_vertex(0)
        g.add_vertex(1)
        g.add_edge(0, 1)

        items = [{"key": 0, "attributes": {}}, {"key": 1, "attributes": {}}]

        name = resolve_variable("node_size", items, g.degree)

        assert name == "ipysigma_kwarg_node_size"

        assert items == [
            {"key": 0, "attributes": {"ipysigma_kwarg_node_size": 1}},
            {"key": 1, "attributes": {"ipysigma_kwarg_node_size": 1}},
        ]

    def test_node_callable_without_args(self):
        def getter():
            return "value"

        name, items = self.resolve_variable("node_value", getter)

        assert name == "ipysigma_kwarg_node_value"
        assert items == [
            {
                "key": "one",
                "attributes": {"ipysigma_kwarg_node_value": "value"},
            },
            {
                "key": "two",
                "attributes": {"ipysigma_kwarg_node_value": "value"},
            },
        ]

    def test_node_callable(self):
        def getter(node):
            return node + "_single_value"

        name, items = self.resolve_variable("node_value", getter)

        assert name == "ipysigma_kwarg_node_value"
        assert items == [
            {
                "key": "one",
                "attributes": {"ipysigma_kwarg_node_value": "one_single_value"},
            },
            {
                "key": "two",
                "attributes": {"ipysigma_kwarg_node_value": "two_single_value"},
            },
        ]

    def test_node_callable_with_attributes(self):
        def getter(node, attr):
            assert attr == {}
            return node + "_value"

        name, items = self.resolve_variable("node_value", getter)

        assert name == "ipysigma_kwarg_node_value"
        assert items == [
            {"key": "one", "attributes": {"ipysigma_kwarg_node_value": "one_value"}},
            {"key": "two", "attributes": {"ipysigma_kwarg_node_value": "two_value"}},
        ]

    def test_iterable(self):
        name, items = self.resolve_variable("node_size", range(2))

        assert name == "ipysigma_kwarg_node_size"
        assert items == [
            {"key": "one", "attributes": {"ipysigma_kwarg_node_size": 0}},
            {"key": "two", "attributes": {"ipysigma_kwarg_node_size": 1}},
        ]

    def test_set(self):
        name, items = self.resolve_variable("node_in", {"two"})

        assert name == "ipysigma_kwarg_node_in"
        assert items == [
            {"key": "one", "attributes": {"ipysigma_kwarg_node_in": False}},
            {"key": "two", "attributes": {"ipysigma_kwarg_node_in": True}},
        ]

    # TODO: edges (partitions)


class TestSortItemsPerZindex(object):
    def test_attribute(self):
        items = [
            {"key": "one", "attributes": {"z": 2}},
            {"key": "two", "attributes": {"z": 3}},
            {"key": "three", "attributes": {"z": 1}},
        ]

        sort_items_per_zindex("node_zindex", items, "z")

        assert items == [
            {"key": "three", "attributes": {"z": 1}},
            {"key": "one", "attributes": {"z": 2}},
            {"key": "two", "attributes": {"z": 3}},
        ]

    def test_callable(self):
        items = [
            {"key": "one", "attributes": {"age": 2}},
            {"key": "two", "attributes": {"age": 3}},
            {"key": "three", "attributes": {"age": 1}},
        ]

        sort_items_per_zindex("node_zindex", items, lambda n, attr: attr["age"] * 2)

        assert items == [
            {"key": "three", "attributes": {"age": 1, "ipysigma_kwarg_node_zindex": 2}},
            {"key": "one", "attributes": {"age": 2, "ipysigma_kwarg_node_zindex": 4}},
            {"key": "two", "attributes": {"age": 3, "ipysigma_kwarg_node_zindex": 6}},
        ]

    def test_mapping(self):
        items = [
            {"key": "one", "attributes": {}},
            {"key": "two", "attributes": {}},
            {"key": "three", "attributes": {}},
        ]

        sort_items_per_zindex("node_zindex", items, {"one": 2, "two": 3, "three": 1})

        assert items == [
            {"key": "three", "attributes": {"ipysigma_kwarg_node_zindex": 1}},
            {"key": "one", "attributes": {"ipysigma_kwarg_node_zindex": 2}},
            {"key": "two", "attributes": {"ipysigma_kwarg_node_zindex": 3}},
        ]
