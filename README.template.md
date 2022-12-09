# ipysigma

A [Jupyter](https://jupyter.org/) widget using [sigma.js](https://www.sigmajs.org/) and [graphology](https://graphology.github.io/) to render interactive networks directly within the result of a notebook cell.

`ipysigma` has been designed to work with either [`networkx`](https://networkx.org/) or [`igraph`](https://igraph.readthedocs.io).

`ipysigma` lets you customize a large number of the graph's visual variables such as: node color, size, label, border, halo, pictogram, shape and edge color, size, type, label etc.

For an exhaustive list of what visual variables you may tweak, check the "[Available visual variables](#available-visual-variables)" part of the documentation.

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

* todo: grid example

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

* categorical data, which means they will map category values to discrete visualization values such as a node's category being associated with a given color.
* continuous data, which means they will map numerical values to a range of sizes or a gradient of colors, like when representing a node's degree by a size on screen.

*kwarg naming rationale*

To be able to be drawn on screen, every visual variable must use values that have a meaning for the the widget's visual representation. For colors, it might be a HTML color name such as `#fa65ea` or `cyan`. For sizes, it might be a number of pixels etc.

If you know what you are doing and want to give `ipysigma` the same "raw" values as those expected by the visual representation directly, all variables have kwargs starting by `raw_`, such as `raw_node_color`.

But if you want `ipysigma` to map your arbitrary values to a suitable visual representation, all variables have a kwarg without any prefix, for instance `node_color`.

In which case, if you use categorical data, `ipysigma` can generate or use palettes to map the category values to e.g. colors on screen. You can always customize the palette or mapping using a kwarg suffixed with `_palette` or `_mapping` such as `node_color_palette` or `node_shape_mapping`.

And if you use numerical data, then values will be mapped to an output range that can be configured with a kwarg suffixed with `_range` for sizes and with `_gradient` for colors, such as `node_size_range` or `node_color_gradient`.

Sometimes, some values might fall out of the represented domain, such as non-numerical values for continuous variables, or categories outside of the colors available in the given palette. In which case there always exists a kwarg prefixed with `default_`, such as `default_node_color`. A neat trick is also to use those kwargs as a way to indicate a constant value if you want all your edges to have the same color for instance, or your nodes to have the same size in pixels.

Finally, it's usually possible to tweak the way numerical values will be mapped from their original domain to the visual one. This is what you do, for instance, when you choose to use a logarithmic scale on a chart to better visualize a specific distribution. Similarly, relevant `ipysigma` visual variables give access to a kwarg suffixed `_scale`, such as `node_color_scale` that lets you easily switch from a linear to a logarithmic or power scale etc. (for more information about this, check [this](#scales-palettes-and-gradients) in the next part of the documentation).

To summarize, let's finish with two exhaustive examples: node color & node size.

*Categorical or continuous variable: node color as an example*

* **node_color**: this kwarg expects some arbitrary values related to your nodes. Those values can be given in multiple ways listed [here](#what-data-can-be-used-as-visual-variable). By default, `node_color` is a categorical variable. Hence, given values will be mapped to suitable colors, from a palette generated automatically for you. If you want your data to be interpreted as continuous instead, you will need to give a gradient to the variable through `node_color_gradient`.
* **raw_node_color**: this kwarg does not expect arbitrary values but CSS colors instead. This way you can always regain full control on the colors you want for your nodes if none of `ipysigma` utilities suit your particular use-case.
* **default_node_color**: the `default_` kwargs always expect a value that will be used in the final representation, so here a CSS color, that will be used if a node category is not found in the color palette or if a node value is not numerical and we are using a gradient.
* **node_color_palette**: by default, `ipysigma` uses [`iwanthue`](https://medialab.github.io/iwanthue/) to automatically generate fitting color palettes for the categories present in the given data. But sometimes you might want to customize the colors used. In which case this kwarg expects either a dictionary mapping category values to a CSS color such as `{'en': 'blue, 'fr': 'red'}` or the name of a categorical color scheme from [d3-scale-chromatic](https://github.com/d3/d3-scale-chromatic#readme) such as `Tableau10` or `RdYlBu` for instance.
* **node_color_gradient**: if you want to use a color gradient for your node to represent continuous data, you will need to give this kwarg either a 2-tuple containing the "lowest" and "highest" color such as `("yellow", "red")` or the name of a continuous color gradient from [d3-scale-chromatic](https://github.com/d3/d3-scale-chromatic#readme) such as `Inferno` or `YlGn` for instance.
* **node_color_scale**: finally, if you gave a gradient to `node_color_gradient` and want to apply a nonlinear scale to the given data, you can pass the name of the scale to use such as `log` or a 2-tuple containing the name of the scale and an optional param such as the scale's base in the case of a logarithmic scale. Here is a binary log scale for instance: `("log", 2)`.

*Continuous variable: node size as an example*

* **node_size**: this kwarg expects some arbitrary numerical values related to your nodes. Those values can be given in multiple ways listed [here](#what-data-can-be-used-as-visual-variable). Then they will be mapped using a scale given to `node_size_scale` to a range in pixels given to `node_size_range` before being used on screen.
* **raw_node_size**: if you want to bypass the scale and the range altogether, this kwarg directly takes values to be considered as pixels on screen.
* **default_node_size**: if no relevant value can be found for a node, or if said value is not a valid number, the widget will use this size, expressed in pixels, instead.
* **node_size_scale**: if you want to apply a nonlinear scale to the given data, you can pass the name of the scale to use such as `log` or a 2-tuple containing the name of the scale and an optional param such as the scale's base in the case of a logarithmic scale. Here is a binary log scale for instance: `("log", 2)`.
* **node_size_range**: this kwarg lets you customize the output range in pixels we should map the node numerical values to. For instance, if we want to have our nodes to have sizes between `1` pixel and `25` pixels, we would give it `(1, 25)`. Note that most visual variables have a default range and this kwarg can usually be omitted if the defaults suit you.

For a comprehensive view of the available visual variables, the values they expect and how they can be customized, read [this](#available-visual-variables) next part of the documentation.

## Scales, palettes and gradients

TODO...

## Frequently asked questions

*How can I display more labels?*

TODO...

*Why are some of my categories mapped to a dull grey?*

TODO...

* pandas
* node_color does not display my colors
* if don't want to display the colors of my gexf
* i want a fancy graph

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

%(sigma_args)s

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

%(sigma_grid_args)s

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
