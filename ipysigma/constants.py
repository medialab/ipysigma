DEFAULT_MAX_CATEGORICAL_COLORS = 10
DEFAULT_HEIGHT = 500
MIN_HEIGHT = 250
DEFAULT_LABEL_FONT = "sans-serif"
DEFAULT_NODE_LABEL_COLOR = "#000"
DEFAULT_NODE_LABEL_SIZE = 12
DEFAULT_NODE_LABEL_SIZE_RANGE = (8, 25)
DEFAULT_NODE_COLOR = "#999"
DEFAULT_NODE_SIZE_RANGE = (3, 15)
DEFAULT_NODE_COLOR_SATURATION_RANGE = (0, 1)
DEFAULT_NODE_BORDER_RATIO_RANGE = (0.1, 0.5)
DEFAULT_NODE_BORDER_SIZE = 1
DEFAULT_NODE_BORDER_SIZE_RANGE = (1, 5)
DEFAULT_NODE_PICTOGRAM_COLOR = "#000"
DEFAULT_NODE_HALO_SIZE = 0
DEFAULT_NODE_HALO_SIZE_RANGE = (0, 20)
DEFAULT_NODE_HALO_COLOR = "red"
DEFAULT_EDGE_COLOR = "#ccc"
DEFAULT_EDGE_SIZE_RANGE = (0.5, 10)
DEFAULT_EDGE_CURVENESS = 0.25
DEFAULT_CAMERA_STATE = {"ratio": 1, "x": 0.5, "y": 0.5, "angle": 0}
SUPPORTED_NODE_TYPES = (int, str, float)
SUPPORTED_RANGE_BOUNDS = (int, str, float)
SUPPORTED_NODE_METRICS = {"louvain"}
SUPPORTED_UNDIRECTED_EDGE_TYPES = {"rectangle", "line", "curve"}
SUPPORTED_DIRECTED_EDGE_TYPES = SUPPORTED_UNDIRECTED_EDGE_TYPES | {"arrow", "triangle"}
SUPPORTED_SYNC_TARGETS = {"layout", "camera", "selection", "hover"}
SUPPORTED_SCALE_TYPES = {"lin", "log", "log+1", "pow", "sqrt"}
SUPPORTED_NAMED_PALETTES = {
    "IWantHue",
    "Accent",
    "Blues",
    "BrBG",
    "BuGn",
    "BuPu",
    "Category10",
    "Dark2",
    "GnBu",
    "Greens",
    "Greys",
    "OrRd",
    "Oranges",
    "PRGn",
    "Paired",
    "Pastel1",
    "Pastel2",
    "PiYG",
    "PuBu",
    "PuBuGn",
    "PuOr",
    "PuRd",
    "Purples",
    "RdBu",
    "RdGy",
    "RdPu",
    "RdYlBu",
    "RdYlGn",
    "Reds",
    "Set1",
    "Set2",
    "Set3",
    "Spectral",
    "Tableau10",
    "YlGn",
    "YlGnBu",
    "YlOrBr",
    "YlOrRd",
}
SUPPORTED_NAMED_GRADIENTS = {
    "Blues",
    "BrBG",
    "BuGn",
    "BuPu",
    "Cividis",
    "Cool",
    "CubehelixDefault",
    "GnBu",
    "Greens",
    "Greys",
    "Inferno",
    "Magma",
    "OrRd",
    "Oranges",
    "PRGn",
    "PiYG",
    "Plasma",
    "PuBu",
    "PuBuGn",
    "PuOr",
    "PuRd",
    "Purples",
    "Rainbow",
    "RdBu",
    "RdGy",
    "RdPu",
    "RdYlBu",
    "RdYlGn",
    "Reds",
    "Sinebow",
    "Spectral",
    "Turbo",
    "Viridis",
    "Warm",
    "YlGn",
    "YlGnBu",
    "YlOrBr",
    "YlOrRd",
}
