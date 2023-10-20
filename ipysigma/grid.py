from itertools import count
from ipywidgets import VBox, HBox
from ipywidgets.embed import embed_minimal_html
from IPython.display import display
from collections.abc import Iterable


from ipysigma.sigma import Sigma
from ipysigma.interfaces import check_graph_is_valid

GRID_COUNTER = count(1)


class SigmaGrid(object):
    """
    A class that can be used to display a small multiples grid of synchronized
    views of a same graph easily.

    Args:
        graph (nx.AnyGraph or ig.AnyGraph): networkx or igraph graph instance
            to visualize.
        columns (int, optional): maximum number of views to display in a line.
            Defaults to 2.
        sync_key (str, otpional): synchronization key to use. If not given, one
            will be automatically generated by the grid. Defaults to None.
        views (list, optional): list of kwarg dicts that will be used to
            instantiate the underlying Sigma views as an alternative to using
            the `#.add` method. Defaults to None.
        **kwargs: any other kwarg will be passed as-is to Sigma views.

    """

    def __init__(self, graph, columns=2, sync_key=None, views=None, **kwargs):
        check_graph_is_valid(graph)

        if not isinstance(columns, int) or columns < 1:
            raise TypeError("columns should be an int >= 1")

        self.__graph = graph
        self.__views = []
        self.__columns = columns
        self.__sync_key = (
            sync_key
            if sync_key is not None
            else "SigmaGrid_{}".format(next(GRID_COUNTER))
        )

        default_kwargs = {"sync_key": self.__sync_key, "hide_info_panel": True}
        default_kwargs.update(kwargs)

        self.__default_kwargs = default_kwargs

        if views is not None:
            if not isinstance(views, Iterable):
                raise TypeError("views should be iterable")

            for view in views:
                if not isinstance(view, dict):
                    raise TypeError(
                        "a view should be a dict of kwargs to pass to a Sigma view"
                    )

                self.add(**view)

    def add(self, **kwargs):
        self.__views.append(Sigma(self.__graph, **self.__default_kwargs, **kwargs))
        return self

    def _ipython_display_(self) -> None:
        if not self.__views:
            raise TypeError(
                "SigmaGrid: there are no views to display. You should use #.add at least once or instanciate SigmaGrid with a non-empty views kwarg."
            )

        hboxes = []
        current_hbox = []

        for i, view in enumerate(self.__views):
            if i > 0 and i % self.__columns == 0:
                hboxes.append(current_hbox)
                current_hbox = []
            current_hbox.append(view)

        hboxes.append(current_hbox)

        display(VBox([HBox(hbox) for hbox in hboxes]))

    def to_html(self, path):
        """
        Method to save the grid of graphs to an HTML file.

        Args:
            path (str): The path where the HTML file will be saved.
        """
        try:
            # Create a list to hold the views for embedding
            views_to_embed = self.__views

            # Save the grid to an HTML file
            embed_minimal_html(path, views=views_to_embed)
            print(f"Grid successfully saved to {path}")

        except Exception as e:
            print(f"An error occurred while saving the grid to HTML: {e}")

    @classmethod
    def write_html(cls, graph, path, columns=2, sync_key=None, views=None, fullscreen=False, **kwargs):
        """
        Class method to write the grid to an HTML file.

        Args:
            graph: The graph to visualize.
            path (str): The path where the HTML file will be saved.
            columns (int, optional): The number of columns in the grid.
            sync_key (str, optional): The synchronization key.
            views (list, optional): List of views.
            fullscreen (bool, optional): Whether to display the grid in fullscreen.
            **kwargs: Additional keyword arguments.
        """
        try:
            if fullscreen:
                kwargs["height"] = None
                kwargs["raw_height"] = "calc(100vh - 16px)"

            # Create an instance of SigmaGrid
            grid_instance = cls(graph, columns, sync_key, views, **kwargs)

            # Save the grid to an HTML file
            grid_instance.to_html(path)

        except Exception as e:
            print(f"An error occurred while creating the SigmaGrid instance or saving to HTML: {e}")