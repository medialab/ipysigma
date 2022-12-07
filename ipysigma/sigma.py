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
from traitlets import Unicode, Dict, Int, Bool, Tuple, List, Float
from collections.abc import Iterable
from ._frontend import module_name, module_version

from ipysigma.interfaces import get_graph_interface, check_graph_is_valid
from ipysigma.utils import (
    fix_items_for_json_serialization,
    pretty_print_int,
    resolve_metrics,
    resolve_variable,
    sort_items_per_zindex,
    VisualVariableBuilder,
)
from ipysigma.gexf import process_node_gexf_viz, process_edge_gexf_viz
from ipysigma.constants import (
    DEFAULT_MAX_CATEGORICAL_COLORS,
    DEFAULT_HEIGHT,
    MIN_HEIGHT,
    DEFAULT_LABEL_FONT,
    DEFAULT_NODE_COLOR,
    DEFAULT_NODE_COLOR_SATURATION_RANGE,
    DEFAULT_NODE_LABEL_COLOR,
    DEFAULT_NODE_LABEL_SIZE,
    DEFAULT_NODE_LABEL_SIZE_RANGE,
    DEFAULT_NODE_SIZE_RANGE,
    DEFAULT_NODE_BORDER_RATIO_RANGE,
    DEFAULT_NODE_BORDER_SIZE,
    DEFAULT_NODE_BORDER_SIZE_RANGE,
    DEFAULT_NODE_PICTOGRAM_COLOR,
    DEFAULT_NODE_HALO_SIZE_RANGE,
    DEFAULT_NODE_HALO_COLOR,
    DEFAULT_EDGE_COLOR,
    DEFAULT_EDGE_SIZE_RANGE,
    DEFAULT_EDGE_CURVENESS,
    DEFAULT_CAMERA_STATE,
    SUPPORTED_NODE_TYPES,
    SUPPORTED_NODE_METRICS,
    SUPPORTED_UNDIRECTED_EDGE_TYPES,
    SUPPORTED_DIRECTED_EDGE_TYPES,
    SUPPORTED_SYNC_TARGETS,
)


# =============================================================================
# Widget definition
# =============================================================================
class Sigma(DOMWidget):
    """
    A Jupyter widget using sigma.js and graphology to render interactive
    networks directly within the result of a notebook cell.

    Args:
        graph (nx.AnyGraph or ig.AnyGraph): networkx or igraph graph instance
            to explore.
        name (str, optional): name of the graph. Defaults to None.
        height (int, optional): height of the widget container in pixels.
            Defaults to 500.
        start_layout (bool or float, optional): whether to automatically start
            the layout algorithm when mounting the widget. If a number is given
            instead, the layout algorithm will start and automatically stop
            after this many seconds. Defaults to False.
        node_metrics (Iterable or Mapping, optional): node metrics to be
            computed by graphology by the widget's JavaScript code. Currently
            only supports "louvain" for community detection.
            Defaults to None.
        layout_settings (dict, optional): settings for the ForceAtlas2 layout
            (listed here: https://graphology.github.io/standard-library/layout-forceatlas2#settings)
            Defaults to None.
        clickable_edges (bool, optional): whether to allow user to click on edges
            to display their information. This can have a performance cost on
            larger graphs. Defaults to False.
        process_gexf_viz (bool, optional): whether to process gexf files viz
            data for node & edges. Defaults to True.
        max_categorical_colors (int, optional): max number of colors to be
            generated for a categorical palette. Categories, ordered by
            frequency, over this maximum will use the default color.
            Defaults to 10.
        hide_info_panel (bool, optional): whether to hide the information panel
            to the right of the widget. Defaults to False.
        hide_search (bool, optional): whether to hide the search bar to the
            right of the widget. Defaults to False.
        hide_edges_on_move (bool, optional): whether to hide the edges when the
            graph is being moved. This can be useful to improve performance
            when the graph is too large. Defaults to False.
        sync_key (str, optional): Key used by the widget to synchronize events
            between multiple instances of views of a same graph. Prefer using
            `SigmaGrid` when able, it will handle this advanced aspect of the
            widget for you.
        sync_targets (Iterable, optional): Names of targets to synchronize
            through the `sync_key` kwarg. Targets include "layout", "camera",
            "selection" and "hover". Defaults to ("layout", "camera", "selection", "hover").
        camera_state (dict, optional): Initial state for the widget's camera (which can be
            retrieved using the `#.get_camera_state` method).
            Defaults to {"x": 0.5, "y": 0.5, "ratio": 1, "angle": 0}.
        selected_node (str or int, optional): Key of the initially selected node in
            the widget (can be retrieved using the `#.get_selected_node` method).
            Defaults to None.
        selected_edge (tuple, optional): (source, target) tuple of the initially
            selected edge in the widget (can be retrieved using the
            `#.get_selected_edge` method).
            Defaults to None.
        selected_node_category_values (Iterable, optional): list of selected node category
            values (can be retrieved using the `#.get_selected_node_category_values` method).
            Defaults to None.
        selected_edge_category_values (Iterable, optional): list of selected edge category
            values (can be retrieved using the `#.get_selected_edge_category_values` method).
            Defaults to None.
        label_font (str, optional): font to be used with labels. Defaults to "sans-serif".
        label_density (int, optional): number of labels to display per grid cell for
            default camera zoom. Defaults to 1.
        label_grid_cell_size (int, optional): size in pixels of a square cell in the label
            selection grid. Defaults to 250.
        label_rendered_size_threshold (int, optional): minimum actual rendered size
            (after camera zoom operations) a node must have on screen for its label to
            be allowed to be displayed. If None, the threshold will be inferred based
            on the maximum node size of your graph.
            Defaults to None.
        show_all_labels (bool, optional): macro setting making sure most, if not all, labels
            get displayed on screen. Might have an impact on performance with larger graphs.
            Defaults to False.
        layout (Mapping, optional): node positions, expressed as a mapping of nodes to a {x, y}
            dict. Defaults to None.
        node_color (VariableData, optional): data to be used as categorical or continuous node
            color. Defaults to None.
        raw_node_color (RawVariableData, optional): raw data (colors) to be used for nodes.
            Defaults to "color".
        node_color_gradient (Iterable or str, optional): gradient of colors to map to, for instance:
            (["yellow", "red"]), or name of a d3 continuous color scale (found here:
            https://github.com/d3/d3-scale-chromatic#readme), for instance: "Viridis".
            If given, node color will be interpreted as continuous rather than categorical.
            Defaults to None.
        node_color_scale (Iterable or str, optional): ...
        node_color_palette (Mapping or str, optional): ...
        default_node_color (str, optional): ...
    """

    _model_name = Unicode("SigmaModel").tag(sync=True)
    _model_module = Unicode(module_name).tag(sync=True)
    _model_module_version = Unicode(module_version).tag(sync=True)
    _view_name = Unicode("SigmaView").tag(sync=True)
    _view_module = Unicode(module_name).tag(sync=True)
    _view_module_version = Unicode(module_version).tag(sync=True)

    default_height = DEFAULT_HEIGHT
    default_max_categorical_colors = DEFAULT_MAX_CATEGORICAL_COLORS
    default_node_size_range = DEFAULT_NODE_SIZE_RANGE
    default_edge_size_range = DEFAULT_EDGE_SIZE_RANGE

    data = Dict({"nodes": [], "edges": []}).tag(sync=True)
    height = Unicode(str(DEFAULT_HEIGHT) + "px").tag(sync=True)
    name = Unicode(allow_none=True).tag(sync=True)
    start_layout = Bool(False).tag(sync=True)
    start_layout_for_seconds = Float(allow_none=True).tag(sync=True)
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
    sync_targets = List(SUPPORTED_SYNC_TARGETS).tag(sync=True)
    ui_settings = Dict({"hideInfoPanel": False, "hideSearch": False}).tag(sync=True)
    renderer_settings = Dict(
        {
            "labelGridCellSize": 250,
            "labelDensity": 1,
        }
    ).tag(sync=True)
    max_categorical_colors = Int(DEFAULT_MAX_CATEGORICAL_COLORS).tag(sync=True)
    program_settings = Dict({"nodeBorderRatio": 0.1}).tag(sync=True)
    visual_variables = Dict(VisualVariableBuilder.get_default()).tag(sync=True)

    @classmethod
    def set_defaults(
        cls,
        height=None,
        max_categorical_colors=None,
        node_size_range=None,
        edge_size_range=None,
    ):
        if height is not None:
            if height < MIN_HEIGHT:
                raise TypeError(
                    "Sigma widget cannot have a height < %i px" % MIN_HEIGHT
                )

            cls.default_height = height

        if max_categorical_colors is not None:
            if (
                not isinstance(max_categorical_colors, int)
                or max_categorical_colors < 0
            ):
                raise TypeError("max_categorical_colors should be a positive integer")

            cls.default_max_categorical_colors = max_categorical_colors

        if node_size_range is not None:
            cls.default_node_size_range = node_size_range

        if edge_size_range is not None:
            cls.default_edge_size_range = edge_size_range

    def __init__(
        self,
        graph,
        *,
        # Various options
        name=None,
        height=None,
        raw_height=None,
        start_layout=False,
        node_metrics=None,
        layout_settings=None,
        clickable_edges=False,
        process_gexf_viz=True,
        max_categorical_colors=None,
        hide_info_panel=False,
        hide_search=False,
        hide_edges_on_move=False,
        sync_key=None,
        sync_targets=SUPPORTED_SYNC_TARGETS,
        # Widget state
        camera_state=DEFAULT_CAMERA_STATE,
        selected_node=None,
        selected_edge=None,
        selected_node_category_values=None,
        selected_edge_category_values=None,
        # Label display options
        label_font=DEFAULT_LABEL_FONT,
        label_density=1,
        label_grid_cell_size=250,
        label_rendered_size_threshold=None,
        show_all_labels=False,
        # Node layout
        layout=None,
        # Node color
        node_color=None,
        raw_node_color="color",
        node_color_gradient=None,
        node_color_scale=None,
        node_color_palette=None,
        default_node_color=DEFAULT_NODE_COLOR,
        node_color_saturation=None,
        raw_node_color_saturation=None,
        node_color_saturation_scale=None,
        node_color_saturation_range=DEFAULT_NODE_COLOR_SATURATION_RANGE,
        default_node_color_saturation=None,
        # Node border
        node_border_color=None,
        raw_node_border_color=None,
        node_border_color_gradient=None,
        node_border_color_palette=None,
        default_node_border_color=None,
        node_border_color_from=None,
        node_border_ratio=None,
        raw_node_border_ratio=None,
        node_border_ratio_range=DEFAULT_NODE_BORDER_RATIO_RANGE,
        default_node_border_ratio=None,
        node_border_size=None,
        raw_node_border_size=None,
        node_border_size_range=DEFAULT_NODE_BORDER_SIZE_RANGE,
        default_node_border_size=DEFAULT_NODE_BORDER_SIZE,
        # Node pictogram
        raw_node_pictogram=None,
        default_node_pictogram=None,
        # Node pictogram color
        node_pictogram_color=None,
        raw_node_pictogram_color=None,
        node_pictogram_color_palette=None,
        default_node_pictogram_color=DEFAULT_NODE_PICTOGRAM_COLOR,
        # Node shape
        node_shape=None,
        raw_node_shape=None,
        node_shape_mapping=None,
        default_node_shape=None,
        # Node halo
        node_halo_size=None,
        raw_node_halo_size=None,
        node_halo_size_range=DEFAULT_NODE_HALO_SIZE_RANGE,
        node_halo_size_scale=None,
        default_node_halo_size=None,
        node_halo_color=DEFAULT_NODE_HALO_COLOR,
        raw_node_halo_color=None,
        node_halo_color_gradient=None,
        node_halo_color_scale=None,
        node_halo_color_palette=None,
        default_node_halo_color=None,
        # Node size
        node_size="size",
        raw_node_size=None,
        node_size_range=None,
        node_size_scale=None,
        default_node_size=None,
        # Node label
        raw_node_label="label",
        node_label=None,
        default_node_label=None,
        # Node label size
        node_label_size=None,
        raw_node_label_size=None,
        node_label_size_range=DEFAULT_NODE_LABEL_SIZE_RANGE,
        default_node_label_size=DEFAULT_NODE_LABEL_SIZE,
        # Node label color
        node_label_color=None,
        raw_node_label_color=None,
        node_label_color_palette=None,
        default_node_label_color=DEFAULT_NODE_LABEL_COLOR,
        # Node z index
        node_zindex=None,
        # Edge color
        edge_color=None,
        raw_edge_color="color",
        edge_color_palette=None,
        edge_color_gradient=None,
        edge_color_scale=None,
        edge_color_from=None,
        default_edge_color=DEFAULT_EDGE_COLOR,
        # Edge type
        default_edge_type=None,
        # Edge size
        edge_size="size",
        raw_edge_size=None,
        edge_size_range=None,
        edge_size_scale=None,
        default_edge_size=None,
        # Edge curveness
        default_edge_curveness=DEFAULT_EDGE_CURVENESS,
        # Edge label
        raw_edge_label="label",
        edge_label=None,
        default_edge_label=None,
        # Edge weight
        edge_weight="weight",
        # Edge z index
        edge_zindex=None,
    ):
        super(Sigma, self).__init__()

        check_graph_is_valid(graph)

        # Resolving overridable defaults
        if height is None:
            height = self.default_height

        if max_categorical_colors is None:
            max_categorical_colors = self.default_max_categorical_colors

        if node_size_range is None:
            node_size_range = self.default_node_size_range

        if edge_size_range is None:
            edge_size_range = self.default_edge_size_range

        # Validation
        if height < MIN_HEIGHT:
            raise TypeError("Sigma widget cannot have a height < %i px" % MIN_HEIGHT)

        if not isinstance(max_categorical_colors, int) or max_categorical_colors < 0:
            raise TypeError("max_categorical_colors should be a positive integer")

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
        self.height = raw_height if raw_height is not None else str(height) + "px"
        self.name = name
        self.max_categorical_colors = max_categorical_colors
        self.start_layout = bool(start_layout)
        self.start_layout_for_seconds = None

        if type(start_layout) in (int, float):
            self.start_layout_for_seconds = float(start_layout)

        self.snapshot = None
        self.layout = None
        self.layout_settings = layout_settings
        self.ui_settings = {"hideInfoPanel": hide_info_panel, "hideSearch": hide_search}
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
            scale=node_color_scale,
        )
        visual_variables_builder.build_continuous(
            "nodeColorSaturation",
            node_color_saturation,
            raw_node_color_saturation,
            default=default_node_color_saturation,
            scale=node_color_saturation_scale,
            kind="color_saturation",
            range=node_color_saturation_range,
        )
        visual_variables_builder.build_continuous(
            "nodeSize",
            node_size,
            raw_node_size,
            default=default_node_size,
            range=node_size_range,
            scale=node_size_scale,
        )
        visual_variables_builder.build_raw(
            "nodeLabel", node_label, raw_node_label, default=default_node_label
        )
        visual_variables_builder.build_continuous(
            "nodeLabelSize",
            node_label_size,
            raw_node_label_size,
            default=default_node_label_size,
            range=node_label_size_range,
            variable_prefix="label",
        )
        visual_variables_builder.build_categorical_or_continuous(
            "nodeLabelColor",
            node_label_color,
            raw_node_label_color,
            default=default_node_label_color,
            palette=node_label_color_palette,
            variable_prefix="label",
        )

        if node_border_color_from is not None and node_border_color_from != "node":
            raise TypeError('node_border_color_from can only be from "node"')

        visual_variables_builder.build_categorical_or_continuous(
            "nodeBorderColor",
            node_border_color,
            raw_node_border_color,
            default=default_node_border_color,
            palette=node_border_color_palette,
            gradient=node_border_color_gradient,
            variable_prefix="border",
            mapped_from=node_border_color_from,
        )

        visual_variables_builder.build_continuous(
            "nodeBorderSize",
            node_border_size,
            raw_node_border_size,
            default=default_node_border_size,
            range=node_border_size_range,
            variable_prefix="border",
        )

        visual_variables_builder.build_continuous(
            "nodeBorderRatio",
            node_border_ratio,
            raw_node_border_ratio,
            default=default_node_border_ratio,
            range=node_border_ratio_range,
            variable_prefix="border",
            kind="ratio",
        )

        visual_variables_builder.build_categorical_or_continuous(
            "nodeHaloColor",
            node_halo_color,
            raw_node_halo_color,
            default=default_node_halo_color,
            palette=node_halo_color_palette,
            gradient=node_halo_color_gradient,
            variable_prefix="halo",
            scale=node_halo_color_scale,
        )
        visual_variables_builder.build_continuous(
            "nodeHaloSize",
            node_halo_size,
            raw_node_halo_size,
            default=default_node_halo_size,
            range=node_halo_size_range,
            scale=node_halo_size_scale,
            variable_prefix="halo",
        )

        visual_variables_builder.build_categorical_or_continuous(
            "nodePictogram",
            None,
            raw_node_pictogram,
            default=default_node_pictogram,
            kind="pictogram",
        )

        visual_variables_builder.build_categorical_or_continuous(
            "nodePictogramColor",
            node_pictogram_color,
            raw_node_pictogram_color,
            default=default_node_pictogram_color,
            palette=node_pictogram_color_palette,
            variable_prefix="pictogram",
            kind="color",
        )

        visual_variables_builder.build_categorical_or_continuous(
            "nodeShape",
            node_shape,
            raw_node_shape,
            default=default_node_shape,
            palette=node_shape_mapping,
            kind="shape",
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
            scale=edge_color_scale,
        )
        visual_variables_builder.build_continuous(
            "edgeSize",
            edge_size,
            raw_edge_size,
            default=default_edge_size,
            range=edge_size_range,
            scale=edge_size_scale,
        )
        visual_variables_builder.build_raw(
            "edgeLabel", edge_label, raw_edge_label, default=default_edge_label
        )
        visual_variables_builder.build_continuous(
            "edgeCurveness", None, None, default=default_edge_curveness
        )

        self.visual_variables = visual_variables_builder.build()

        must_render_node_borders = self.visual_variables["nodeBorderColor"][
            "type"
        ] != "disabled" and (
            self.visual_variables["nodeBorderSize"]["type"] != "disabled"
            or self.visual_variables["nodeBorderRatio"]["type"] != "disabled"
        )

        must_render_node_halos = (
            self.visual_variables["nodeHaloColor"]["type"] != "disabled"
            and self.visual_variables["nodeHaloSize"]["type"] != "disabled"
        )

        if self.visual_variables["nodeShape"]["type"] != "disabled":
            if must_render_node_borders:
                raise TypeError("cannot use node borders with node shapes together")

            if must_render_node_halos:
                raise TypeError("cannot use node halos and node shapes together")

            if self.visual_variables["nodePictogram"]["type"] != "disabled":
                raise TypeError("cannot use node pictograms and node shapes together")

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

        if show_all_labels:
            label_rendered_size_threshold = 0
            label_density = 10_000

        # Building renderer settings
        renderer_settings = {
            "zIndex": True,
            "enableEdgeClickEvents": clickable_edges,
            "enableEdgeHoverEvents": clickable_edges,
            "labelDensity": label_density,
            "labelGridCellSize": label_grid_cell_size,
            "renderEdgeLabels": True,
            "labelFont": label_font,
            "hideEdgesOnMove": hide_edges_on_move,
        }

        if label_rendered_size_threshold is not None:
            renderer_settings[
                "labelRenderedSizeThreshold"
            ] = label_rendered_size_threshold

        need_to_render_pictograms = (
            self.visual_variables["nodePictogram"]["type"] != "disabled"
        )

        need_to_render_shapes = self.visual_variables["nodeShape"]["type"] != "disabled"

        default_node_type = "point"

        if must_render_node_borders:
            default_node_type = "border"

            if need_to_render_pictograms:
                default_node_type = "border+picto"

                if must_render_node_halos:
                    default_node_type = "border+halo+picto"

            elif must_render_node_halos:
                default_node_type = "border+halo"

        elif need_to_render_pictograms:
            default_node_type = "picto"

            if must_render_node_halos:
                default_node_type = "halo+picto"

        elif need_to_render_shapes:
            default_node_type = "shape"

        elif must_render_node_halos:
            default_node_type = "halo"

        renderer_settings["defaultNodeType"] = default_node_type

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

        fix_items_for_json_serialization(nodes)
        fix_items_for_json_serialization(edges)

        self.data = {
            "nodes": nodes,
            "edges": edges,
            "options": {
                "type": "directed" if is_directed else "undirected",
                "multi": is_multi,
            },
        }

        self.sync_key = sync_key
        self.sync_targets = list(sync_targets)

        for target in self.sync_targets:
            if target not in SUPPORTED_SYNC_TARGETS:
                raise TypeError('unsupported sync target "%s"' % target)

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

    def to_html(self, path):

        # Snapshot data unnecessarily adds weight here, let's drop it
        current_snapshot = self.snapshot
        self.snapshot = None

        embed_minimal_html(path, views=[self])

        self.snapshot = current_snapshot

    @classmethod
    def write_html(cls, graph, path, fullscreen=False, **kwargs):
        if fullscreen:
            kwargs["height"] = None
            kwargs["raw_height"] = "calc(100vh - 16px)"

        return cls(graph, **kwargs).to_html(path)
