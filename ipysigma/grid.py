from itertools import count
from ipywidgets import VBox, HBox
from IPython.display import display
from collections.abc import Iterable

from ipysigma.sigma import Sigma
from ipysigma.interfaces import check_graph_is_valid

GRID_COUNTER = count(1)


class SigmaGrid(object):
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
