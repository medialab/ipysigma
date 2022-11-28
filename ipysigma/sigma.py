#!/usr/bin/env python
# coding: utf-8
# =============================================================================
# Sigma Jupyter Widget
# =============================================================================
#
#
from ipywidgets import DOMWidget, Output
from ipywidgets.embed import embed_minimal_html
from IPython.display import Image, display
from traitlets import Unicode, Dict, Int, Bool, Tuple, List
from collections.abc import Iterable
from ._frontend import module_name, module_version

from ipysigma.interfaces import get_graph_interface
from ipysigma.utils import (
    pretty_print_int,
    resolve_metrics,
    resolve_variable,
    sort_items_per_zindex,
    VisualVariableBuilder,
)
from ipysigma.gexf import process_node_gexf_viz, process_edge_gexf_viz
from ipysigma.constants import (
    DEFAULT_MAX_CATEGORY_COLORS,
    DEFAULT_HEIGHT,
    MIN_HEIGHT,
    DEFAULT_NODE_SIZE_RANGE,
    DEFAULT_NODE_BORDER_RATIO_RANGE,
    DEFAULT_EDGE_SIZE_RANGE,
    DEFAULT_CAMERA_STATE,
    SUPPORTED_NODE_TYPES,
    SUPPORTED_NODE_METRICS,
    SUPPORTED_UNDIRECTED_EDGE_TYPES,
    SUPPORTED_DIRECTED_EDGE_TYPES,
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
            Defaults to None, i.e. will read the "color" attribute of nodes
            directly or use a grey color if none is to be found.
        node_size (str, optional): name of the node attribute that should be
            used for node size. Note the provided size is scaled using
            the range provided by the `node_size_range` kwarg.
            Defaults to "size".
        node_size_range ((number, number), optional): range for node size
            interpolation. Defaults to (2, 12).
        node_label (str, optional): name of the node attribute that will be used
            as node label. Defaults to "label".
        edge_color (str, optional): name of the edge attribute that should
            be interpreted as a category to be used for edge color. Note that
            a suitable color palette will be automatically generated for you.
            Defaults to None, i.e. will read the "color" attribute of edges
            directly or use a light grey color if none is to be found.
        edge_size (str, optional): name of the edge attribute that should be
            used for edge size. Note the provided size is scaled using
            the range provided by the `edge_size_range` kwarg.
            Defaults to "size".
        edge_size_range ((number, number), optional): range for edge size
            interpolation. Defaults to (0.5, 10).
        edge_label (str, optional): name of the edge attribute that will be used
            as edge label. Defaults to None, i.e. no label.
        camera_state (dict, optional): camera state of the widget, which is a dict
            of shape {x, y, ratio, angle}. Can be retrieved using the `get_camera_state`
            method. Defaults to {x: 0.65, y: 0.5, ratio: 1, angle: 0}.
        layout (dict, optional): dict mapping nodes to {x, y} positions.
            Defaults to None.
        layout_settings (dict, optional): settings for ForceAtlas2 layout.
            Defaults to None, i.e. using default settings.
        clickable_edges (bool, optional): whether to enable edge events so you can
            click on them to get information. This can be costly on large graphs.
            Defaults to False.
        process_gexf_viz (bool, optional): whether to process "viz" data typically
            found in gexf files so they can be displayed correctly.
            Defaults to True.
    """

    _model_name = Unicode("SigmaModel").tag(sync=True)
    _model_module = Unicode(module_name).tag(sync=True)
    _model_module_version = Unicode(module_version).tag(sync=True)
    _view_name = Unicode("SigmaView").tag(sync=True)
    _view_module = Unicode(module_name).tag(sync=True)
    _view_module_version = Unicode(module_version).tag(sync=True)

    default_height = DEFAULT_HEIGHT
    default_max_category_colors = DEFAULT_MAX_CATEGORY_COLORS
    default_node_size_range = DEFAULT_NODE_SIZE_RANGE
    default_edge_size_range = DEFAULT_EDGE_SIZE_RANGE

    data = Dict({"nodes": [], "edges": []}).tag(sync=True)
    height = Int(DEFAULT_HEIGHT).tag(sync=True)
    start_layout = Bool(False).tag(sync=True)
    clickable_edges = Bool(False).tag(sync=True)
    snapshot = Unicode(allow_none=True).tag(sync=True)
    layout = Dict(allow_none=True).tag(sync=True)
    camera_state = Dict(DEFAULT_CAMERA_STATE).tag(sync=True)
    layout_settings = Dict(allow_none=True).tag(sync=True)
    node_metrics = Dict({}).tag(sync=True)
    edge_weight = Unicode(allow_none=True).tag(sync=True)
    selected_node = Unicode(allow_none=True).tag(sync=True)
    selected_edge = Tuple(allow_none=True).tag(sync=True)
    selected_node_category_values = List(allow_none=True).tag(sync=True)
    selected_edge_category_values = List(allow_none=True).tag(sync=True)
    sync_key = Unicode(allow_none=True).tag(sync=True)
    renderer_settings = Dict(
        {
            "labelGridCellSize": 250,
            "labelDensity": 1,
        }
    ).tag(sync=True)
    max_category_colors = Int(DEFAULT_MAX_CATEGORY_COLORS).tag(sync=True)
    program_settings = Dict({"nodeBorderRatio": 0.1}).tag(sync=True)
    visual_variables = Dict(VisualVariableBuilder.get_default()).tag(sync=True)

    @classmethod
    def set_defaults(
        cls,
        height=None,
        max_category_colors=None,
        node_size_range=None,
        edge_size_range=None,
    ):
        if height is not None:
            if height < MIN_HEIGHT:
                raise TypeError(
                    "Sigma widget cannot have a height < %i px" % MIN_HEIGHT
                )

            cls.default_height = height

        if max_category_colors is not None:
            if not isinstance(max_category_colors, int) or max_category_colors < 0:
                raise TypeError("max_category_colors should be a positive integer")

            cls.default_max_category_colors = max_category_colors

        if node_size_range is not None:
            cls.default_node_size_range = node_size_range

        if edge_size_range is not None:
            cls.default_edge_size_range = edge_size_range

    def __init__(
        self,
        graph,
        *,
        # Various options
        height=None,
        start_layout=False,
        node_metrics=None,
        layout_settings=None,
        clickable_edges=False,
        process_gexf_viz=True,
        max_category_colors=None,
        sync_key=None,
        # Widget state
        camera_state=DEFAULT_CAMERA_STATE,
        selected_node=None,
        selected_edge=None,
        selected_node_category_values=None,
        selected_edge_category_values=None,
        # Label display options
        label_density=1,
        label_grid_cell_size=250,
        label_rendered_size_threshold=None,
        # Node layout
        layout=None,
        # Node color
        node_color=None,
        raw_node_color="color",
        node_color_gradient=None,
        node_color_palette=None,
        default_node_color="#999",
        # Node borders
        node_borders=False,
        node_border_color=None,
        raw_node_border_color=None,
        node_border_color_gradient=None,
        node_border_color_palette=None,
        default_node_border_color="#fff",
        node_border_ratio=None,
        raw_node_border_ratio=None,
        node_border_ratio_range=DEFAULT_NODE_BORDER_RATIO_RANGE,
        default_node_border_ratio=0.1,
        # Node size
        node_size="size",
        raw_node_size=None,
        node_size_range=None,
        default_node_size=None,
        # Node label
        raw_node_label="label",
        node_label=None,
        # Node z index
        node_zindex=None,
        # Edge color
        edge_color=None,
        raw_edge_color="color",
        edge_color_palette=None,
        edge_color_gradient=None,
        edge_color_from=None,
        default_edge_color="#ccc",
        # Edge type
        default_edge_type=None,
        # Edge size
        edge_size="size",
        raw_edge_size=None,
        edge_size_range=None,
        default_edge_size=None,
        # Edge label
        raw_edge_label="label",
        edge_label=None,
        # Edge weight
        edge_weight="weight",
        # Edge z index
        edge_zindex=None,
    ):
        super(Sigma, self).__init__()

        # Resolving overridable defaults
        if height is None:
            height = self.default_height

        if max_category_colors is None:
            max_category_colors = self.default_max_category_colors

        if node_size_range is None:
            node_size_range = self.default_node_size_range

        if edge_size_range is None:
            edge_size_range = self.default_edge_size_range

        # Validation
        if height < MIN_HEIGHT:
            raise TypeError("Sigma widget cannot have a height < %i px" % MIN_HEIGHT)

        if not isinstance(max_category_colors, int) or max_category_colors < 0:
            raise TypeError("max_category_colors should be a positive integer")

        if selected_node is not None and selected_edge is not None:
            raise TypeError(
                "selected_node and selected_edge cannot be given at the same time"
            )

        if selected_node is not None:
            if not isinstance(selected_node, SUPPORTED_NODE_TYPES):
                raise TypeError("selected_node should be str, int or float")

            if selected_node not in graph:
                raise KeyError("selected_node does not exist in the graph")

        if selected_edge is not None:
            if (
                not isinstance(selected_edge, tuple)
                or len(selected_edge) != 2
                or not isinstance(selected_edge[0], SUPPORTED_NODE_TYPES)
                or not isinstance(selected_edge[1], SUPPORTED_NODE_TYPES)
            ):
                raise TypeError("selected_edge should be a (source, target) tuple")

            if not self.graph_interface.has_edge(*selected_edge):
                raise KeyError("selected_edge does not exist in the graph")

        if selected_node_category_values is not None and not isinstance(
            selected_node_category_values, Iterable
        ):
            raise TypeError(
                "selected_node_category_values should be an iterable of node keys"
            )

        if selected_edge_category_values is not None and not isinstance(
            selected_edge_category_values, Iterable
        ):
            raise TypeError(
                "selected_edge_category_values should be an iterable of edge keys"
            )

        # Own
        self.graph = graph
        self.graph_interface = get_graph_interface(self.graph)

        # Traits
        self.height = height
        self.max_category_colors = max_category_colors
        self.start_layout = start_layout
        self.snapshot = None
        self.layout = None
        self.layout_settings = layout_settings
        self.clickable_edges = clickable_edges
        self.camera_state = camera_state
        self.selected_node = str(selected_node) if selected_node is not None else None
        self.selected_edge = (
            (str(selected_edge[0]), str(selected_edge[1]))
            if selected_edge is not None
            else None
        )
        self.selected_node_category_values = (
            list(selected_node_category_values)
            if selected_node_category_values
            else None
        )
        self.selected_edge_category_values = (
            list(selected_edge_category_values)
            if selected_edge_category_values
            else None
        )
        self.node_metrics = resolve_metrics(
            "node_metrics", node_metrics, SUPPORTED_NODE_METRICS
        )

        if layout is not None:
            if not isinstance(layout, dict):
                raise TypeError(
                    "layout should be a dict from nodes to {x, y} positions"
                )

            self.layout = layout

        is_directed = self.graph_interface.is_directed()
        is_multi = self.graph_interface.is_multi()

        # Serializing graph as per graphology's JSON format
        nodes = []
        self.node_type = None

        for node, attr in self.graph_interface.nodes():
            if self.node_type is None:
                self.node_type = type(node)

                if not isinstance(node, SUPPORTED_NODE_TYPES):
                    raise TypeError(
                        "ipysigma does not support graph with node keys which are not str, int or float (found a %s key)"
                        % self.node_type.__name__
                    )
            elif type(node) is not self.node_type:
                raise TypeError(
                    "ipysigma does not support mixed types for node keys (found %s and %s)"
                    % (self.node_type.__name__, type(node).__name__)
                )

            attr = attr.copy()

            if process_gexf_viz:
                process_node_gexf_viz(attr)

            serialized_node = {"key": node, "attributes": attr}

            nodes.append(serialized_node)

        edges = []

        for source, target, attr in self.graph_interface.edges():
            attr = attr.copy()

            if process_gexf_viz:
                process_edge_gexf_viz(attr)

            # NOTE: networkx multigraph can have keys on edges, but they
            # are not required to be unique across the graph, which makes
            # them pointless for graphology, gexf etc.
            serialized_edge = {"source": source, "target": target, "attributes": attr}

            edges.append(serialized_edge)

        # Serializing visual variables
        visual_variables_builder = VisualVariableBuilder(nodes, edges, is_directed)

        # Nodes
        visual_variables_builder.build_categorical_or_continuous(
            "nodeColor",
            node_color,
            raw_node_color,
            default=default_node_color,
            palette=node_color_palette,
            gradient=node_color_gradient,
        )
        visual_variables_builder.build_continuous(
            "nodeSize",
            node_size,
            raw_node_size,
            default=default_node_size,
            range=node_size_range,
        )
        visual_variables_builder.build_raw("nodeLabel", node_label, raw_node_label)

        if node_borders:
            visual_variables_builder.build_categorical_or_continuous(
                "nodeBorderColor",
                node_border_color,
                raw_node_border_color,
                default=default_node_border_color,
                palette=node_border_color_palette,
                gradient=node_border_color_gradient,
                variable_prefix="border",
            )
            visual_variables_builder.build_continuous(
                "nodeBorderRatio",
                node_border_ratio,
                raw_node_border_ratio,
                default=default_node_border_ratio,
                range=node_border_ratio_range,
            )

        # Edges
        if edge_color_from is not None:
            if not is_directed:
                raise TypeError("edge_color_from only works with directed graphs")

            if edge_color_from not in ["source", "target"]:
                raise TypeError('edge_color_from should be "source" or "target"')

        visual_variables_builder.build_categorical_or_continuous(
            "edgeColor",
            edge_color,
            raw_edge_color,
            default=default_edge_color,
            mapped_from=edge_color_from,
            palette=edge_color_palette,
            gradient=edge_color_gradient,
        )
        visual_variables_builder.build_continuous(
            "edgeSize",
            edge_size,
            raw_edge_size,
            default=default_edge_size,
            range=edge_size_range,
        )
        visual_variables_builder.build_raw("edgeLabel", edge_label, raw_edge_label)

        self.visual_variables = visual_variables_builder.build()

        # Handling edge weight
        self.edge_weight = None

        if edge_weight is not None:
            self.edge_weight = resolve_variable(
                "edge_weight",
                edges,
                edge_weight,
                item_type="edge",
                is_directed=is_directed,
            )

        # Handling z-index
        if node_zindex is not None:
            sort_items_per_zindex("node_zindex", nodes, node_zindex)

        if edge_zindex is not None:
            sort_items_per_zindex(
                "edge_zindex",
                edges,
                edge_zindex,
                item_type="edge",
                is_directed=is_directed,
            )

        # Building renderer settings
        renderer_settings = {
            "zIndex": True,
            "enableEdgeClickEvents": clickable_edges,
            "enableEdgeHoverEvents": clickable_edges,
            "labelDensity": label_density,
            "labelGridCellSize": label_grid_cell_size,
            "renderEdgeLabels": True,
        }

        if label_rendered_size_threshold is not None:
            renderer_settings[
                "labelRenderedSizeThreshold"
            ] = label_rendered_size_threshold

        if default_edge_type is not None:
            if is_directed and default_edge_type not in SUPPORTED_DIRECTED_EDGE_TYPES:
                raise TypeError(
                    'unsupported edge type "%s" for directed graphs' % default_edge_type
                )

            if (
                not is_directed
                and default_edge_type not in SUPPORTED_UNDIRECTED_EDGE_TYPES
            ):
                raise TypeError(
                    'unsupported edge type "%s" for undirected graphs'
                    % default_edge_type
                )

            renderer_settings["defaultEdgeType"] = default_edge_type

        else:
            renderer_settings["defaultEdgeType"] = (
                "arrow" if is_directed else "rectangle"
            )

        self.renderer_settings = renderer_settings

        # Building webgl program settings
        self.program_settings = {}

        self.data = {
            "nodes": nodes,
            "edges": edges,
            "options": {
                "type": "directed" if is_directed else "undirected",
                "multi": is_multi,
            },
        }

        self.sync_key = sync_key

    def __repr__(self):
        return "Sigma(%s with %s nodes and %s edges)" % (
            self.graph_interface.name(),
            pretty_print_int(self.graph_interface.order()),
            pretty_print_int(self.graph_interface.size()),
        )

    def get_layout(self):
        """
        Method returning the layout computed by ForceAtlas2 in the widget.

        Note that if the layout was never displayed, this method will return None.

        Also note that if you never ran the layout this method will return the
        initial layout that will be random in the [0, 1) range if you did not
        provide starting positions yourself.

        Returns:
            dict: a dictionary mapping node keys to {x, y} positions.
        """
        if self.layout is None:
            return None

        return {self.node_type(n): p for n, p in self.layout.items()}

    def get_camera_state(self):
        """
        Method returning the current camera state of the widget.
        """
        return self.camera_state

    def get_selected_node(self):
        if self.selected_node is not None:
            return self.node_type(self.selected_node)

    def get_selected_edge(self):
        if self.selected_edge is not None:
            return (
                self.node_type(self.selected_edge[0]),
                self.node_type(self.selected_edge[1]),
            )

    def get_selected_node_category_values(self):
        return self.selected_node_category_values

    def get_selected_edge_category_values(self):
        return self.selected_edge_category_values

    def render_snapshot(self):
        """
        Method rendering and displaying a snasphot of the widget.

        This can be useful to save a version of the widget that can actually
        be seen in a static rendition of your notebook (when using nbconvert,
        for instance, or when reading the notebook on GitHub).

        Returns:
            Ipython.display.HTML: the snasphot as a data url in an img tag.
        """

        out = Output()
        out.append_stdout(
            "Rendering snapshot from widget (are you sure the widget is currently displayed?)..."
        )

        def on_update(change):
            if change.new is None:
                return

            out.clear_output()

            with out:
                display(Image(url=change.new))

            self.unobserve(on_update, "snapshot")

        self.observe(on_update, "snapshot")
        self.send({"msg": "render_snapshot"})

        return out

    def save_as_html(self, path, **kwargs):

        # Snapshot data unnecessarily adds weight here, let's drop it
        current_snapshot = self.snapshot
        self.snapshot = None

        embed_minimal_html(path, views=[self], **kwargs)

        self.snapshot = current_snapshot
