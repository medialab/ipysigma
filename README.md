# ipysigma

A [Jupyter](https://jupyter.org/) widget using [sigma.js](https://www.sigmajs.org/) and [graphology](https://graphology.github.io/) to render interactive networks directly within the result of a notebook cell.

`ipysigma` has been designed to work with either [`networkx`](https://networkx.org/) or [`igraph`](https://igraph.readthedocs.io).

<p align="center">
  <img alt="ipysigma" src="./docs/img/ipysigma.gif">
</p>

## Summary

- [Installation](#installation)
- [Quick start](#quick-start)
- [TODO: Examples](#examples)
- [TODO: Available visual variables](#)
- [TODO: What can be used as visual variable](#)
- [TODO: Visual variables and kwarg naming rationale](#)
- [TODO: Scales, palettes and gradients](#)
- [TODO: Frequently asked questions](#frequently-asked-questions)
- [API Reference](#api-reference)
  - [Sigma](#sigma)
  - [SigmaGrid](#sigmagrid)
- [Using in Google Colab](#using-in-google-colab)

## Installation

You can install using `pip`:

```bash
pip install ipysigma
```

You will also need to install either `networkx` or `igraph` of course.

If you are using an older version of Jupyter, you might also need to enable the nbextension likewise:

```bash
jupyter nbextension enable --py --sys-prefix ipysigma

# You might need one of those other commands
jupyter nbextension enable --py --user ipysigma
jupyter nbextension enable --py --system ipysigma
```

## Quick start

*Using networkx*

```python
import networkx as nx
from ipysigma import Sigma

# Importing a gexf graph
g = nx.read_gexf('./my-graph.gexf')

# Displaying the graph with a size mapped on degree and
# a color mapped on a categorical attribute of the nodes
Sigma(g, node_size=g.degree, node_color='category')
```

*Using igraph*

```python
import igraph as ig
from ipysigma import Sigma

# Generating a graph
g = ig.Graph.Famous('Zachary')

# Displaying the graph with a size mapped on degree and
# a color mapped on node betweenness centrality, using
# the a continuous color scale named "Viridis"
Sigma(g, node_size=g.degree, node_color=g.betweenness(), node_color_gradient='Viridis')
```

## Examples

## Frequently asked questions

*How can I display more labels?*

TODO...

## API Reference

### Sigma

*Arguments*

* **graph** *nx.AnyGraph or ig.AnyGraph* - networkx or igraph graph instance to explore.
* **name** *str, optional* `None` - name of the graph.
* **height** *int, optional* `500` - height of the widget container in pixels.
* **raw_height** *str, optional* `None` - raw css height. Can be useful in some html embedding scenarios. Only use this if you know what you are doing.
* **start_layout** *bool or float, optional* `False` - whether to automatically start the layout algorithm when mounting the widget. If a number is given instead, the layout algorithm will start and automatically stop after this many seconds.
* **node_metrics** *Iterable or Mapping, optional* `None` - node metrics to be computed by graphology by the widget's JavaScript code. Currently only supports "louvain" for community detection.
* **layout_settings** *dict, optional* `None` - settings for the ForceAtlas2 layout (listed here: https://graphology.github.io/standard-library/layout-forceatlas2#settings.
* **clickable_edges** *bool, optional* `False` - whether to allow user to click on edges to display their information. This can have a performance cost on larger graphs.
* **process_gexf_viz** *bool, optional* `True` - whether to process gexf files viz data for node & edges.
* **max_categorical_colors** *int, optional* `10` - max number of colors to be generated for a categorical palette. Categories, ordered by frequency, over this maximum will use the default color.
* **hide_info_panel** *bool, optional* `False` - whether to hide the information panel to the right of the widget.
* **hide_search** *bool, optional* `False` - whether to hide the search bar to the right of the widget.
* **hide_edges_on_move** *bool, optional* `False` - whether to hide the edges when the graph is being moved. This can be useful to improve performance when the graph is too large.
* **sync_key** *str, optional* - Key used by the widget to synchronize events between multiple instances of views of a same graph. Prefer using `SigmaGrid` when able, it will handle this advanced aspect of the widget for you.
* **sync_targets** *Iterable, optional* `("layout", "camera", "selection", "hover")` - Names of targets to synchronize through the `sync_key` kwarg. Targets include "layout", "camera", "selection" and "hover".
* **camera_state** *dict, optional* `{"x": 0.5, "y": 0.5, "ratio": 1, "angle": 0}` - Initial state for the widget's camera (which can be retrieved using the `#.get_camera_state` method).
* **selected_node** *str or int, optional* `None` - Key of the initially selected node in the widget (can be retrieved using the `#.get_selected_node` method).
* **selected_edge** *tuple, optional* `None` - (source, target) tuple of the initially selected edge in the widget (can be retrieved using the `#.get_selected_edge` method).
* **selected_node_category_values** *Iterable, optional* `None` - list of selected node category values (can be retrieved using the `#.get_selected_node_category_values` method).
* **selected_edge_category_values** *Iterable, optional* `None` - list of selected edge category values (can be retrieved using the `#.get_selected_edge_category_values` method).
* **label_font** *str, optional* `"sans-serif"` - font to be used with labels.
* **label_density** *int, optional* `1` - number of labels to display per grid cell for default camera zoom.
* **label_grid_cell_size** *int, optional* `250` - size in pixels of a square cell in the label selection grid.
* **label_rendered_size_threshold** *int, optional* `None` - minimum actual rendered size (after camera zoom operations) a node must have on screen for its label to be allowed to be displayed. If None, the threshold will be inferred based on the maximum node size of your graph.
* **show_all_labels** *bool, optional* `False` - macro setting making sure most, if not all, labels get displayed on screen. Might have an impact on performance with larger graphs.
* **layout** *Mapping, optional* `None` - node positions, expressed as a `{node: {x, y}` mapping.
* **node_color** *VariableData, optional* `None` - data to be used as categorical or continuous node color.
* **raw_node_color** *RawVariableData, optional* `"color"` - raw data (colors) to be used for nodes.
* **node_color_gradient** *Iterable or str, optional* `None` - gradient of colors to map to, for instance: (["yellow", "red"]), or name of a d3 continuous color scale (found here: https://github.com/d3/d3-scale-chromatic#readme), for instance: "Viridis". If given, node color will be interpreted as continuous rather than categorical.
* **node_color_scale** *tuple or str, optional* `None` - scale to use for node color. Can be a tuple containing the name of the scale and an additional param such as an exponent, or just the name of the scale to use: e.g. `("log", 2)` or `"pow"`. Available scales include: "lin", "log", "log+1", "pow" & "sqrt". If None is given, scale will default to "lin" for linear.
* **node_color_palette** *Mapping or str, optional* `None` - either a mapping from category values to css colors or the name of a d3 categorical color scale (found here: https://github.com/d3/d3-scale-chromatic#readme).
* **default_node_color** *str, optional* - default color for nodes.

### SigmaGrid

*Arguments*

* **graph** *nx.AnyGraph or ig.AnyGraph* - networkx or igraph graph instance to visualize.
* **columns** *int, optional* `2` - maximum number of views to display in a line.
* **sync_key** *str, otpional* `None` - synchronization key to use. If not given, one will be automatically generated by the grid.
* **views** *list, optional* `None` - list of kwarg dicts that will be used to instantiate the underlying Sigma views as an alternative to using the `#.add` method.
* ****kwargs** - any other kwarg will be passed as-is to Sigma views.

## Using in Google Colab

If you want to be able to use `ipysigma` on [Google Colab](https://colab.research.google.com), you will need to enable widget output using the following code:

```python
from google.colab import output

output.enable_custom_widget_manager()
```

Remember you can always install packages in Colab by executing the following command in a cell:

```
!pip install networkx ipysigma
```
