def pretty_print_int(v):
    return "{:,}".format(int(v))


def extract_rgba_from_viz(viz_color):
    if "a" in viz_color:
        return "rgba(%s, %s, %s, %s)" % (
            viz_color["r"],
            viz_color["g"],
            viz_color["b"],
            viz_color["a"],
        )

    return "rgba(%s, %s, %s)" % (
        viz_color["r"],
        viz_color["g"],
        viz_color["b"],
    )


def is_indexable(value):
    return (
        not isinstance(value, (str, bytes))
        and hasattr(value, "__getitem__")
        and callable(value.__getitem__)
    )


def is_partition(value):
    return (
        isinstance(value, list)
        and len(value) > 0
        and isinstance(value[0], (set, frozenset, list))
    )
