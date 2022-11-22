from inspect import signature, Parameter
from collections import Mapping

from ipysigma.interfaces import is_networkx_degree_view


def count_arity(fn) -> int:
    parameters = signature(fn).parameters

    return sum(1 if p.default == Parameter.empty else 0 for p in parameters.values())


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


def is_partition(value):
    return (
        isinstance(value, list)
        and len(value) > 0
        and isinstance(value[0], (set, frozenset, list))
    )


def resolve_variable(name, items, target, item_type="node", is_directed=False):

    # If we have a partition, we recast it as a mapping
    if is_partition(target):
        partition = target
        target = {}

        for i, group in enumerate(partition):
            for item in group:
                target[item] = i

    # Attribute name
    if isinstance(target, str):
        return target

    # Range mapping
    elif isinstance(target, list):
        mapping = target
        target = "ipysigma_kwarg_%s" % name

        for item, value in zip(items, mapping):
            item["attributes"][target] = value

        return target

    # Arbitrary mapping
    # NOTE: must be used before callable to handle stuff like g.degree
    elif isinstance(target, Mapping) or is_networkx_degree_view(target):
        mapping = target
        target = "ipysigma_kwarg_%s" % name

        for item in items:
            if item_type == "node":
                try:
                    v = mapping[item["key"]]
                except KeyError:
                    v = None
            else:
                try:
                    v = mapping[(item["source"], item["target"])]
                except KeyError:
                    if not is_directed:
                        try:
                            v = mapping[(item["target"], item["source"])]
                        except KeyError:
                            v = None
                    else:
                        v = None

            if v is None:
                continue

            item["attributes"][target] = v

        return target

    # Callable
    elif callable(target):
        fn = target
        target = "ipysigma_kwarg_%s" % name

        arity = count_arity(fn)

        if item_type == "node" and arity not in [1, 2]:
            raise TypeError(
                "%s is expecting a function taking node or node and attributes as arguments"
                % name
            )

        elif item_type == "edge" and arity not in [2, 3]:
            raise TypeError(
                "%s is expecting a function taking source, target or source, target and attributes as arguments"
                % name
            )

        for item in items:
            if item_type == "node":
                if arity == 1:
                    v = fn(item["key"])
                else:
                    v = fn(item["key"], item["attributes"])
            else:
                if arity == 2:
                    v = fn(item["source"], item["target"])
                else:
                    v = fn(item["source"], item["target"], item["attributes"])

            if v is None:
                continue

            item["attributes"][target] = v

        return target

    # Fail
    else:
        raise TypeError(
            "%s should be an attribute name, or a mapping, or a partition, or a function"
            % name
        )
