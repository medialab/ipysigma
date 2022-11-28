from itertools import count
from ipywidgets import VBox, HBox
from IPython.display import display

from ipysigma.sigma import Sigma

GRID_COUNTER = count(1)


class SigmaGrid(object):
    def __init__(self, graph, columns=2, sync_key=None, **kwargs):
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

    def add(self, **kwargs):
        self.__views.append(Sigma(self.__graph, **self.__default_kwargs, **kwargs))
        return self

    def _ipython_display_(self) -> None:
        if not self.__views:
            raise TypeError(
                "SigmaGrid: there are no views to display. You should use #.add at least once."
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
