from io import StringIO
from functools import partial
from IPython.display import HTML


def render_as_svg(graph):
    buffer = StringIO()

    p = partial(print, file=buffer)

    p('<svg width=100 height=100 viewBox="0 0 100 100" version="1.1" xmlns="http://www.w3.org/2000/svg">')
    p('  <circle r="5" fill="red" />')
    p('</svg>')

    return HTML(buffer.getvalue())
