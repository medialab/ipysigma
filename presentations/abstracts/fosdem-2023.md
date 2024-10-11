# ipysigma: a Jupyter widget for interactive visual network analysis

Jupyter notebooks are a great tool for exploratory data analysis as it is very easy to process and visualize data using traditional charts. However, they lack utilities to properly explore networks interactively. The ipysigma library therefore proposes a Jupyter widget enabling its users to perform visual network analysis from the comfort of a notebook. ipysigma makes it simple to tweak a network's visual variables to display it exactly as you intend. This way, you can perform a work at the crossroad between Python processing of graph data and visual exploration like you would do for example with Gephi. It supports networkx and igraph seamlessly and can be easily used by numpy and pandas users all the same. Different usecases of ipysigma will be showcased during the talk through a dataset about FOSDEM history. We will also demonstrate how ipysigma is able to render synchronized & interactive "small multiples" of a same network so that one can easily compare different features. ipysigma is developed at the médialab of SciencesPo and uses graphology and sigma.js (JavaScript libraries able to render interactive graphs in web browsers).