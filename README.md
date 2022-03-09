# ipysigma

A Jupyter widget using sigma.js to render interactive networks.

## Summary

- [Installation](#installation)
- [Usage](#usage)
- [Development Installation](#development-installation)
  - [How to see your changes](#how-to-see-your-changes)
    - [Typescript](#typescript)
    - [Python](#python)
  - [How to bump version](#how-to-bump-version)
  - [How to release](#how-to-release)

## Installation

You can install using `pip`:

```bash
pip install ipysigma
```

If you are using Jupyter Notebook 5.2 or earlier, you may also need to enable
the nbextension:

```bash
jupyter nbextension enable --py --sys-prefix ipysigma

# You might need one of those other commands
jupyter nbextension enable --py --user ipysigma
jupyter nbextension enable --py --system ipysigma
```

## Usage

```python
import networkx as nx
from ipysigma import Sigma

# Creating a dummy graph to serve as example
g = nx.karate_club_graph()

# Displaying the graph
Sigma(g)

# Tweaking height of widget
Sigma(g, height=300)

# Starting layout automatically
Sigma(g, start_layout=True)

# Displaying a gexf file
g = nx.read_gexf('./path/to/file.gexf')
Sigma(g)
```

## Development Installation

Be sure to have a working installation of Node.js >= 14.

Create a dev environment using conda or pyenv:

```bash
# Using pyenv
pyenv virtualenv 3.6.10 ipysigma
pyenv local ipysigma

# Using conda
conda create -n ipysigma-dev -c conda-forge nodejs yarn python jupyterlab
conda activate ipysigma-dev
```

Install the python package. This will also build the TS package.

```bash
pip install -e ".[test, examples]"
```

When developing your extensions, you need to manually enable your extensions with the
notebook / lab frontend. For lab, this is done by the command:

```
jupyter labextension develop --overwrite .
yarn run build
```

For classic notebook, you need to run:

```
jupyter nbextension install --sys-prefix --symlink --overwrite --py ipysigma
jupyter nbextension enable --sys-prefix --py ipysigma
```

Note that the `--symlink` flag doesn't work on Windows, so you will here have to run
the `install` command every time that you rebuild your extension. For certain installations
you might also need another flag instead of `--sys-prefix`, but we won't cover the meaning
of those flags here.

Alternatively you can also run `make deps` that will handle all of the above for you.

### How to see your changes

#### Typescript

If you use JupyterLab to develop then you can watch the source directory and run JupyterLab at the same time in different
terminals to watch for changes in the extension's source and automatically rebuild the widget.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
yarn run watch
# Run JupyterLab in another terminal
jupyter lab
```

After a change wait for the build to finish and then refresh your browser and the changes should take effect.

#### Python

If you make a change to the python code then you will need to restart the notebook kernel to have it take effect.

### How to bump version

You need to make sure to update the version in the following files:

- `package.json`
- `package-lock.json`
- `ipysigma/_frontend.py`
- `ipysigma/_version.py`

### How to release

Run `make release`.
