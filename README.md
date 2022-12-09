# ipysigma

A [Jupyter](https://jupyter.org/) widget using [sigma.js](https://www.sigmajs.org/) and [graphology](https://graphology.github.io/) to render interactive networks directly within the result of a notebook cell.

`ipysigma` has been designed to work with either [`networkx`](https://networkx.org/) or [`igraph`](https://igraph.readthedocs.io).

`ipysigma` lets you customize a large number of the graph's visual variables such as: node color, size, label, border, halo, pictogram, shape and edge color, size, type, label etc.

For an exhaustive list of what variables exist, check the "[Available visual variables](#available-visual-variables)" part of the documentation.

<p align="center">
  <img alt="ipysigma" src="./docs/img/ipysigma.gif">
</p>

`ipysigma` is also able to display synchronized & interactive "small multiples" of a same graph to easily compare some of its features.

<p align="center">
  <img alt="ipysigma-grid" src="./docs/img/ipysigma-grid.gif">
</p>

## Summary

- [Installation](#installation)
- [Quick start](#quick-start)
- [Examples](#examples)
- [What data can be used as visual variable](#what-data-can-be-used-as-visual-variable)
- [Visual variables and kwarg naming rationale](#visual-variables-and-kwarg-naming-rationale)
- [Scales, palettes and gradients](#scales-palettes-and-gradients)
- [Frequently asked questions](#frequently-asked-questions)
- [Available visual variables](#available-visual-variables)
  - [node_color](#node_color)
  - [node_color_saturation](#node_color_saturation)
  - [node_size](#node_size)
  - [node_label](#node_label)
  - [node_label_size](#node_label_size)
  - [node_label_color](#node_label_color)
  - [node_border_size](#node_border_size)
  - [node_border_ratio](#node_border_ratio)
  - [node_border_color](#node_border_color)
  - [node_pictogram](#node_pictogram)
  - [node_pictogram_color](#node_pictogram_color)
  - [node_shape](#node_shape)
  - [node_halo_size](#node_halo_size)
  - [node_halo_color](#node_halo_color)
  - [edge_color](#edge_color)
  - [edge_type](#edge_type)
  - [edge_size](#edge_size)
  - [edge_curveness](#edge_curveness)
  - [edge_label](#edge_label)
- [API Reference](#api-reference)
  - [Sigma](#sigma)
    - [#.get_layout](#get_layout)
    - [#.get_camera_state](#get_camera_state)
    - [#.get_selected_node](#get_selected_node)
    - [#.get_selected_edge](#get_selected_edge)
    - [#.get_selected_node_category_values](#get_selected_node_category_values)
    - [#.get_selected_edge_category_values](#get_selected_edge_category_values)
    - [#.render_snapshot](#render_snapshot)
    - [#.to_html](#to_html)
    - [Sigma.write_html](#sigmawrite_html)
  - [SigmaGrid](#sigmagrid)
    - [#.add](#add)
- [Using in Google Colab](#using-in-google-colab)

## Installation

You can install using `pip`:

```bash
pip install ipysigma
```

You will also need to install either `networkx` or `igraph`.

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
# a continuous color scale named "Viridis"
Sigma(g, node_size=g.degree, node_color=g.betweenness(), node_color_gradient='Viridis')
```

## Examples

*Letting the widget compute a Louvain partition and using it as node colors*

```python
Sigma(g, node_metrics=['louvain'], node_color='louvain')
```

*Functional testing notebooks*

If you want comprehensive examples of the widget's visual variables being used,
you can read the notebooks found [here](./notebooks/Tests/), which serve as functional tests to the library.

## What data can be used as visual variable

Several things can be given as data to visual variables and their
raw counterparts (read [this](#visual-variables-and-kwarg-naming-rationale) for a detailed explanation).

Here is the exhaustive list of what is possible:

*Name of a node or edge attribute*

```python
# Let's say your nodes have a "lang" attribute, we can use its modalities as values for
# a categorical color palette:
Sigma(g, node_color='lang')
```

*Node or edge mapping*

```python
# You can store the data in a mapping, e.g. a dictionary, likewise:
node_lang = {'node1': 'en', 'node2': 'fr', ...}
Sigma(g, node_color=node_lang)

# For edges, the mapping's key must be a 2-tuple containing source & target nodes.
# Note that for undirected graphs, the order of nodes in the tuple
# does not make any difference as both will work.
edge_type = {('node1', 'node2'): 'LIKES', ('node2', 'node3'): 'LOVES'}
```

*Arbitrary iterable*

```python
# Any arbitrary iterable such as generators, ranges, numpy vectors,
# pandas series etc. will work. The only requirement is that they should
# follow the order of iteration of nodes or edges in the graph, so we may
# align the data properly.

# Creating a 0 to n generic label for my nodes
Sigma(g, node_label=range(len(g)))

# Random size for my edges
Sigma(g, edge_size=(random() for _ in g.edges))
```

*Partition*

```python
# A partition, complete or not, but not overlapping, of nodes or edges:
# Must be a list of lists or a list of sets.
communities = [{2, 3, 6}, {0, 1}, {4, 6}]

Sigma(g, node_color=communities)
```

*networkx/igraph degree view*

```python
# Mapping node size on degree is as simple as:
Sigma(g, node_size=g.degree)
```

*Arbitrary callable*

```python
# Creating a label for my nodes
Sigma(g, node_label=lambda node: 'Label of ' + str(node))

# Using edge weight as size only for some source nodes
Sigma(g, edge_size=lambda u, v, a: attr['weight'] if g.nodes[u]['part'] == 'main' else 1)

# Node callables will be given the following arguments:
#   1. node key
#   2. node attributes

# Edge callables will be given the following arguments:
#  1. source node key
#  2. target node key
#  3. edge attributes

# Note that given callables may choose to take any number of those arguments.
# For instance, the first example only uses the first argument but still works.
```

*Set*

```python
# A set will be understood as a binary partition with nodes or edges being
# in it or outside it. This will be mapped to a boolean value, with `True`
# meaning the node or edge was in the partition.

# This will display the nodes 1, 5 and 6 in a color, and all the other ones
# in a different color.
Sigma(g, node_color={1, 5, 6})
```

## Visual variables and kwarg naming rationale

`ipysigma` lets its users tweak a large number of [visual variables](#available-visual-variables). They all work through a similar variety of keyword arguments given to the [`Sigma`](#sigma) widget.

In `ipysigma` visual variables can be given:

* categorical data, which means they will map category values to a discrete mapping such as a node's category being associated with a given color.
* continuous data, which means they will map numerical values to a range of sizes or a gradient of colors, like when representing a node's degree by a size on screen.

*kwargs naming rationale*

To be able to be drawn on screen, every visual variable must use values that have a meaning for the the widget's interactive renderer ([sigma.js](https://www.sigmajs.org/), as a matter of fact). For colors, it might need a HTML color name or one expressed in hexadecimal notation. For sizes, it might need a number of pixels etc.

If you know what you are doing and want to give `ipysigma` "raw" values as those used by the visual representation directly, all variables have kwargs starting by `raw_`, such as `raw_node_color`.

But if you want `ipysigma` to map your arbitrary values to a suitable visual representation, all variables have a kwarg without any prefix, for instance `node_color`.

In which case, if you use categorical data, `ipysigma` can generate or use palettes to map the category values to e.g. colors on screen. You can always customize the palette or mapping using a kwarg suffixed with `_palette` or `_mapping` such as `node_color_palette` or `node_shape_mapping`.

And if you use numerical data, then values will be mapped to an output range that can be configured with a kwarg suffixed with `_range` for sizes and with `_gradient` for colors, such as `node_size_range` or `node_color_gradient`.

Sometimes, some values might fall out of the represented domain, such as non-numerical values for continuous variables, or categories outside of your analysis scope. Sometimes you might event want to use a constant value. In which case there always exists a kwarg prefixed with `default_`, such as `default_node_color`.

Finally, it's usually possible to tweak the way numerical values will be mapped from their original domain to the visual one. This is what you do, for instance, when you choose to use a logarithmic scale on a chart to better visualize a specific distribution. In the same way, relevant `ipysigma` visual variables give access to a kwarg suffixed `_scale`, such as `node_color_scale` that lets you easily switch from a linear to a logarithmic or power scale etc. (for more information about this, check [this](#scales-palettes-and-gradients) next part of the documentation).

To summarize, let's finish with two exhaustive examples: node color & node size.

*Categorical or continuous variable: node color as an example*

* **node_color**: this kwarg expects some arbitrary values related to your nodes. Those values can be given in multiple ways listed [here](#what-data-can-be-used-as-visual-variable). By default, `node_color` is a categorical variable. Hence, given values will be mapped to suitable colors, from a palette generated automatically for you. If you want your data to be interpreted as continuous instead, you will need to give a gradient to the variable through `node_color_gradient`.
* **raw_node_color**: this kwarg expect data formatted the same way as `node_color`, but instead it does not expect arbitrary values but CSS colors instead. This way you can always regain full control on the colors you want for your nodes if none of `ipysigma` utilities suit your particular use-case.
* TODO...

*Continuous variable: node size as an example*

TODO...

## Scales, palettes and gradients

TODO...

## Frequently asked questions

*How can I display more labels?*

TODO...

*Why are some of my categories mapped to a dull grey?*

TODO...

## Available visual variables

### node_color

![node_color](./docs/img/node_color.png)

<!-- kwargs, example of raw values, notes -->

### node_color_saturation

![node_color_saturation](./docs/img/node_color_saturation.png)

### node_size

![node_size](./docs/img/node_size.png)

### node_label

![node_label](./docs/img/node_label.png)

### node_label_size

![node_label_size](./docs/img/node_label_size.png)

### node_label_color

![node_label_color](./docs/img/node_label_color.png)

### node_border_size

![node_border_size](./docs/img/node_border_size.png)

### node_border_ratio

![node_border_ratio](./docs/img/node_border_ratio.png)

### node_border_color

![node_border_color](./docs/img/node_border_color.png)

### node_pictogram

![node_pictogram](./docs/img/node_pictogram.png)

### node_pictogram_color

![node_pictogram_color](./docs/img/node_pictogram_color.png)

### node_shape

![node_shape](./docs/img/node_shape.png)

### node_halo_size

![node_halo_size](./docs/img/node_halo_size.png)

### node_halo_color

![node_halo_color](./docs/img/node_halo_color.png)

### edge_color

![edge_color](./docs/img/edge_color.png)

### edge_type

![edge_type](./docs/img/edge_type.png)

### edge_size

![edge_size](./docs/img/edge_size.png)

### edge_curveness

![edge_curveness](./docs/img/edge_curveness.png)

### edge_label

![edge_label](./docs/img/edge_label.png)

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
* **raw_node_color** *VariableData, optional* `"color"` - raw data (css colors) to be used for node colors.
* **node_color_gradient** *Iterable or str, optional* `None` - gradient of colors to map to, for instance: (`("yellow", "red")`), or name of a d3 continuous color scale (found here: https://github.com/d3/d3-scale-chromatic#readme), for instance: "Viridis". If given, node color will be interpreted as continuous rather than categorical.
* **node_color_scale** *tuple or str, optional* `None` - scale to use for node color. Can be a tuple containing the name of the scale and an additional param such as an exponent, or just the name of the scale to use: e.g. `("log", 2)` or `"pow"`. Available scales include: `"lin"`, `"log"`, `"log+1"`, `"pow"` & `"sqrt"`. If None is given, scale will default to `"lin"` for linear.
* **node_color_palette** *Mapping or str, optional* `None` - either a mapping from category values to css colors or the name of a d3 categorical color scale (found here: https://github.com/d3/d3-scale-chromatic#readme).
* **default_node_color** *str, optional* `"#999"` - default color for nodes.
* **node_color_saturation** *VariableData, optional* `None` - data to be used as continuous node color saturation.
* **raw_node_color_saturation** *VariableData, optional* `None` - raw data (percentage) to be used for node color saturation.
* **node_color_saturation_scale** *tuple or str, optional* `None` - scale to use for node color saturation. Can be a tuple containing the name of the scale and an additional param such as an exponent, or just the name of the scale to use: e.g. `("log", 2)` or `"pow"`. Available scales include: `"lin"`, `"log"`, `"log+1"`, `"pow"` & `"sqrt"`. If None is given, scale will default to `"lin"` for linear.
* **node_color_saturation_range** *Iterable, optional* `(0, 1)` - range of percentages to map to, for instance: `(0, 0.7)`.
* **default_node_color_saturation** *str, optional* `None` - default color saturation for nodes.
* **node_border_color** *VariableData, optional* `None` - data to be used as categorical or continuous node border color.
* **raw_node_border_color** *VariableData, optional* `"color"` - raw data (css colors) to be used for node border colors.
* **node_border_color_gradient** *Iterable or str, optional* `None` - gradient of colors to map to, for instance: (`("yellow", "red")`), or name of a d3 continuous color scale (found here: https://github.com/d3/d3-scale-chromatic#readme), for instance: "Viridis". If given, node border color will be interpreted as continuous rather than categorical.
* **node_border_color_palette** *Mapping or str, optional* `None` - either a mapping from category values to css colors or the name of a d3 categorical color scale (found here: https://github.com/d3/d3-scale-chromatic#readme).
* **node_border_color_from** *str, optional* `None` - optionally select node border color from the following options: "node".
* **default_node_border_color** *str, optional* - default color for node borders.
* **node_border_size** *VariableData, optional* `None` - data to be used as continuous node border size.
* **raw_node_border_size** *VariableData, optional* `None` - raw data (size in pixels) to be used for node border sizes.
* **node_border_size_range** *Iterable, optional* `(1, 5)` - range of sizes in pixels to map to, for instance: `(1, 15)`.
* **default_node_border_size** *int or float, optional* `1` - default size for node borders.
* **node_border_ratio** *VariableData, optional* `None` - data to be used as continuous node border ratio.
* **raw_node_border_ratio** *VariableData, optional* `None` - raw data (ratio in pixels) to be used for node border ratios.
* **node_border_ratio_range** *Iterable, optional* `(0.1, 0.5)` - range of ratios in pixels to map to, for instance: `(1, 15)`.
* **default_node_border_ratio** *int or float, optional* `0.1` - default ratio for node borders.
* **raw_node_pictogram** *VariableData, optional* `None` - raw data (pictogram name, as found here: https://fonts.google.com/icons or publicly accessible svg icon url) to be used for node pictograms.
* **default_node_pictogram** *str, optional* `None` - default pictogram for nodes.
* **node_pictogram_color** *VariableData, optional* `None` - data to be used as categorical or continuous node pictogram color.
* **raw_node_pictogram_color** *VariableData, optional* `"color"` - raw data (css colors) to be used for node pictogram colors.
* **node_pictogram_color_palette** *Mapping or str, optional* `None` - either a mapping from category values to css colors or the name of a d3 categorical color scale (found here: https://github.com/d3/d3-scale-chromatic#readme).
* **default_node_pictogram_color** *str, optional* `"black"` - default color for node pictograms.
* **node_shape** *VariableData, optional* `None` - data to be used as categorical data to be mapped to node shapes.
* **raw_node_shape** *VariableData, optional* `None` - raw data (shape name, or pictogram name as found here: https://fonts.google.com/icons or publicly accessible svg icon url) to be used as node shapes.
* **node_shape_mapping** *Mapping, optional* - mapping from category values to node shapes.
* **default_node_shape** *str, optional* `None` - default shape for nodes.
* **node_halo_color** *VariableData, optional* `None` - data to be used as categorical or continuous node halo color.
* **raw_node_halo_color** *VariableData, optional* `"color"` - raw data (css colors) to be used for node halo colors.
* **node_halo_color_gradient** *Iterable or str, optional* `None` - gradient of colors to map to, for instance: (`("yellow", "red")`), or name of a d3 continuous color scale (found here: https://github.com/d3/d3-scale-chromatic#readme), for instance: "Viridis". If given, node halo color will be interpreted as continuous rather than categorical.
* **node_halo_color_palette** *Mapping or str, optional* `None` - either a mapping from category values to css colors or the name of a d3 categorical color scale (found here: https://github.com/d3/d3-scale-chromatic#readme).
* **default_node_halo_color** *str, optional* `"red"` - default color for node halos.
* **node_halo_size** *VariableData, optional* `None` - data to be used as continuous node halo size.
* **raw_node_halo_size** *VariableData, optional* `None` - raw data (size in pixels) to be used for node halo sizes.
* **node_halo_size_range** *Iterable, optional* `(0, 20)` - range of sizes in pixels to map to, for instance: `(1, 15)`.
* **default_node_halo_size** *int or float, optional* `0` - default size for node halos.
* **node_size** *VariableData, optional* `"size"` - data to be used as continuous node size.
* **raw_node_size** *VariableData, optional* `None` - raw data (size in pixels) to be used for node sizes.
* **node_size_range** *Iterable, optional* `(3, 15)` - range of sizes in pixels to map to, for instance: `(1, 15)`.
* **node_size_scale** *tuple or str, optional* `None` - scale to use for node size. Can be a tuple containing the name of the scale and an additional param such as an exponent, or just the name of the scale to use: e.g. `("log", 2)` or `"pow"`. Available scales include: `"lin"`, `"log"`, `"log+1"`, `"pow"` & `"sqrt"`. If None is given, scale will default to `"lin"` for linear.
* **default_node_size** *int or float, optional* `None` - default size for nodes.
* **node_label** *VariableData, optional* `None` - data to be used as node label.
* **raw_node_label** *VariableData, optional* `"label"` - raw data (label string) to be used for node labels.
* **default_node_label** *str, optional* `None` - default label for nodes.
* **node_label_size** *VariableData, optional* `None` - data to be used as continuous node label size.
* **raw_node_label_size** *VariableData, optional* `None` - raw data (size in pixels) to be used for node label sizes.
* **node_label_size_range** *Iterable, optional* `(8, 25)` - range of sizes in pixels to map to, for instance: `(1, 15)`.
* **default_node_label_size** *int or float, optional* `12` - default size for node labels.
* **node_label_color** *VariableData, optional* `None` - data to be used as categorical or continuous node label color.
* **raw_node_label_color** *VariableData, optional* `None` - raw data (css colors) to be used for node label colors.
* **node_label_color_palette** *Mapping or str, optional* `None` - either a mapping from category values to css colors or the name of a d3 categorical color scale (found here: https://github.com/d3/d3-scale-chromatic#readme).
* **default_node_label_color** *str, optional* `"black"` - default color for node labels.
* **node_zindex** *VariableData, optional* `None` - numerical data used to sort nodes before rendering. Nodes having a higher zindex will be drawn on top of nodes having a lower one.
* **edge_color** *VariableData, optional* `None` - data to be used as categorical or continuous edge color.
* **raw_edge_color** *VariableData, optional* `"color"` - raw data (css colors) to be used for edge colors.
* **edge_color_gradient** *Iterable or str, optional* `None` - gradient of colors to map to, for instance: (`("yellow", "red")`), or name of a d3 continuous color scale (found here: https://github.com/d3/d3-scale-chromatic#readme), for instance: "Viridis". If given, edge color will be interpreted as continuous rather than categorical.
* **edge_color_scale** *tuple or str, optional* `None` - scale to use for edge color. Can be a tuple containing the name of the scale and an additional param such as an exponent, or just the name of the scale to use: e.g. `("log", 2)` or `"pow"`. Available scales include: `"lin"`, `"log"`, `"log+1"`, `"pow"` & `"sqrt"`. If None is given, scale will default to `"lin"` for linear.
* **edge_color_palette** *Mapping or str, optional* `None` - either a mapping from category values to css colors or the name of a d3 categorical color scale (found here: https://github.com/d3/d3-scale-chromatic#readme).
* **default_edge_color** *str, optional* `"#999"` - default color for edges.
* **default_edge_type** *str, optional* `None` - default type used to draw edges. Can be selected from `"rectangle"`, `"line"`, `"curve"`, `"arrow"` & `"triangle"`. Will raise if `"arrow"` or `"triangle"` is selected with an undirected graph. If None, will default to `"rectangle"`.
* **edge_size** *VariableData, optional* `"size"` - data to be used as continuous edge size.
* **raw_edge_size** *VariableData, optional* `None` - raw data (size in pixels) to be used for edge sizes.
* **edge_size_range** *Iterable, optional* `(3, 15)` - range of sizes in pixels to map to, for instance: `(1, 15)`.
* **edge_size_scale** *tuple or str, optional* `None` - scale to use for edge size. Can be a tuple containing the name of the scale and an additional param such as an exponent, or just the name of the scale to use: e.g. `("log", 2)` or `"pow"`. Available scales include: `"lin"`, `"log"`, `"log+1"`, `"pow"` & `"sqrt"`. If None is given, scale will default to `"lin"` for linear.
* **default_edge_size** *int or float, optional* `None` - default size for edges.
* **default_edge_curveness** *str, optional* `0.25` - curveness factor for edges when `default_edge_type` is `"curve"`.
* **edge_label** *VariableData, optional* `None` - data to be used as edge label.
* **raw_edge_label** *VariableData, optional* `"label"` - raw data (label string) to be used for edge labels.
* **edge_weight** *VariableData, optional* - numerical data to be used as edge weight for weighted metrics & layout computations (distinct from size, which is used for rendering).
* **edge_zindex** *VariableData, optional* `None` - numerical data used to sort egdes before rendering. Egdes having a higher zindex will be drawn on top of egdes having a lower one.

#### #.get_layout

Method returning the layout of the graph, i.e. the current node positions in the widget, as a dict mapping nodes to their `{x, y}` coordinates.

#### #.get_camera_state

Method returning the current camera state of the widget, as a `{x, y, ratio, angle}` dict.

#### #.get_selected_node

Method returning the currently selected node if any or `None`.

#### #.get_selected_edge

Method returning the currently selected edge as a `(source, target)` tuple if any or `None`.

#### #.get_selected_node_category_values

Method returning a set of currently selected node category values or `None`.

#### #.get_selected_edge_category_values

Method returning a set of currently selected edge category values or `None`.

#### #.render_snapshot

Method rendering the widget as an rasterized image in the resulting cell.

#### #.to_html

Method rendering the widget as a standalone HTML file that can be hosted statically elsewhere.

*Arguments*

* **path** *PathLike or file*: where to save the HTML file.

#### Sigma.write_html

Static method taking the same kwargs as [`Sigma`](#sigma) and rendering the widget as a standalone HTML file that can be hosted statically elsewhere.

*Arguments*

* **graph** *nx.AnyGraph or ig.AnyGraph*: graph to represent.
* **path** *PathLike or file*: where to save the HTML file.
* **fullscreen** *bool, optional* [`False`]: whether to display the widget by taking up the full space of the screen. If `False`, will follow the given `height`.
* ****kwarg**: any kwarg accepted by [`Sigma`](#sigma).

### SigmaGrid

*Arguments*

* **graph** *nx.AnyGraph or ig.AnyGraph* - networkx or igraph graph instance to visualize.
* **columns** *int, optional* `2` - maximum number of views to display in a line.
* **sync_key** *str, otpional* `None` - synchronization key to use. If not given, one will be automatically generated by the grid.
* **views** *list, optional* `None` - list of kwarg dicts that will be used to instantiate the underlying Sigma views as an alternative to using the `#.add` method.
* ****kwargs** - any other kwarg will be passed as-is to Sigma views.

#### #.add

Method one can use as an alternative or combined to `SigmaGrid` constructor's `views` kwarg to add a new `Sigma` view to the grid. It takes any argument taken by [`Sigma`](#sigma) and returns self for easy chaining.

```python
SigmaGrid(g, node_color='category').add(node_size=g.degree).add(node_size='occurrences')
```

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
