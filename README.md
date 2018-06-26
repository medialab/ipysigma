ipysigma
===============================

A custom Jupyter widget library to display graphs using sigma.js

Installation
------------

To install use pip:

    $ pip install ipysigma
    $ jupyter nbextension enable --py --sys-prefix ipysigma # can be skipped for notebook 5.3 and above

If you have JupyterLab, you will also need to install the JupyterLab extension (note that it does not work with jupyterlab>0.27.0 and node>9):

    $ jupyter labextension install ipysigma

For a development installation (requires npm),

    $ git clone https://github.com/ipysigma.git
    $ cd ipysigma
    $ pip install -e .
    $ jupyter nbextension install --py --symlink --sys-prefix ipysigma
    $ jupyter nbextension enable --py --sys-prefix ipysigma
