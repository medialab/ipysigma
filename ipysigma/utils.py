from inspect import signature, Parameter
from collections import Mapping, Sequence

from ipysigma.interfaces import is_networkx_degree_view
from ipysigma.constants import SUPPORTED_RANGE_BOUNDS


def count_arity(fn) -> int:
    parameters = signature(fn).parameters

    return sum(1 if p.default == Parameter.empty else 0 for p in parameters.values())


def pretty_print_int(v):
    return "{:,}".format(int(v))


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


def resolve_metrics(name, target, supported):
    if not target:
        return {}

    if isinstance(target, Sequence) and not isinstance(target, (str, bytes)):
        metrics = {}

        for v in target:
            spec = v

            if isinstance(v, str):
                spec = {"name": v}

            metrics[spec["name"]] = spec

    elif isinstance(target, Mapping):
        metrics = {}

        for k, v in target.items():
            spec = v

            if isinstance(v, str):
                spec = {"name": v}

            metrics[k] = spec
    else:
        raise TypeError(
            name
            + " should be a list of metrics to compute or a dict mapping metric names to attribute names"
        )

    for v in metrics.values():
        metric_name = v["name"]
        if metric_name not in supported:
            raise TypeError(
                'unknown %s "%s", expecting one of %s'
                % (name, metric_name, ", ".join('"%s"' % m for m in supported))
            )

    return metrics


def resolve_range(name, target):
    if target is None:
        return

    if isinstance(target, SUPPORTED_RANGE_BOUNDS):
        return (target, target)

    if (
        isinstance(target, Sequence)
        and len(target) == 2
        and isinstance(target[0], SUPPORTED_RANGE_BOUNDS)
        and isinstance(target[1], SUPPORTED_RANGE_BOUNDS)
    ):
        if isinstance(target[0], str) and not isinstance(target[1], str):
            raise TypeError(name + " contain mixed type (min, max) info")

        return target

    raise TypeError(
        name + " should be a single value or a (min, max) sequence (list, tuple etc.)"
    )


def check_zindex_int_return(fn):
    def wrapper(*args):
        z = fn(*args)

        if not isinstance(z, int):
            raise TypeError("zindex values should be None or an int")

        return z

    return wrapper


def sort_items_per_zindex(name, items, sorter, item_type="node", is_directed=True):
    zindex_attr_name = resolve_variable(
        name, items, sorter, item_type=item_type, is_directed=is_directed
    )

    def item_key(item):
        return item["attributes"].get(zindex_attr_name, 0)

    items.sort(key=item_key)
