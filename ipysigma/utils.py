from inspect import signature, Parameter
from datetime import date, datetime
from collections.abc import Mapping, Sequence, Iterable

from ipysigma.shim import is_nan
from ipysigma.interfaces import is_networkx_degree_view
from ipysigma.constants import (
    SUPPORTED_RANGE_BOUNDS,
    SUPPORTED_SCALE_TYPES,
    SUPPORTED_NAMED_GRADIENTS,
    SUPPORTED_NAMED_PALETTES,
    DEFAULT_NODE_SIZE_RANGE,
    DEFAULT_NODE_LABEL_SIZE,
    DEFAULT_NODE_LABEL_COLOR,
    DEFAULT_EDGE_CURVENESS,
    DEFAULT_EDGE_SIZE_RANGE,
    DEFAULT_NODE_PICTOGRAM_COLOR,
)


def fix_items_for_json_serialization(items):
    for item in items:
        attr = item["attributes"]

        for k, v in attr.items():
            if is_nan(v):
                attr[k] = None

            elif isinstance(v, (date, datetime)):
                attr[k] = v.isoformat()


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


# TODO: name in error
def resolve_scale(value):
    if value is None:
        return None

    if isinstance(value, str):
        value = (value, None)
    elif isinstance(value, Iterable):
        try:
            value = iter(value)
            value = (next(value), next(value))
        except StopIteration:
            raise TypeError("scale should be a type or a (type, param) tuple")

    if value[0] not in SUPPORTED_SCALE_TYPES:
        raise TypeError('unknown scale type "%s"' % value[0])

    if value[1] is not None and not isinstance(value[1], (int, float)):
        raise TypeError("scale param should be a number")

    return value


def resolve_palette(name, value):
    if isinstance(value, str):
        if value not in SUPPORTED_NAMED_PALETTES:
            raise TypeError('unknown named palette scheme "%s"' % value)
        return value

    if not isinstance(value, Mapping):
        raise TypeError("{} should be a mapping (i.e. a dict)".format(name))

    return list(value.items())


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

    # Sets
    elif isinstance(target, (set, frozenset)):
        mapping = target
        target = "ipysigma_kwarg_%s" % name

        for item in items:
            v = False

            if item_type == "node":
                v = item["key"] in mapping
            else:
                v = (item["source"], item["target"]) in mapping

                if not v and is_directed:
                    v = (item["target"], item["source"]) in mapping

            item["attributes"][target] = v

        return target

    # Iterable range
    elif isinstance(target, Iterable):
        mapping = target
        target = "ipysigma_kwarg_%s" % name

        for item, value in zip(items, mapping):
            item["attributes"][target] = value

        return target

    # Callable
    elif callable(target):
        fn = target
        target = "ipysigma_kwarg_%s" % name

        arity = count_arity(fn)

        if item_type == "node" and arity > 2:
            raise TypeError(
                "%s is expecting a function taking node or node and attributes as arguments"
                % name
            )

        elif item_type == "edge" and arity > 3:
            raise TypeError(
                "%s is expecting a function taking source, target or source, target and attributes as arguments"
                % name
            )

        for item in items:
            if item_type == "node":
                if arity == 0:
                    v = fn()
                elif arity == 1:
                    v = fn(item["key"])
                else:
                    v = fn(item["key"], item["attributes"])
            else:
                if arity == 0:
                    v = fn()
                elif arity == 1:
                    v = fn(item["source"])
                elif arity == 2:
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


def resolve_range(name, target, allow_named=False):
    if target is None:
        return

    if allow_named and isinstance(target, str):
        if target not in SUPPORTED_NAMED_GRADIENTS:
            raise TypeError("unknown named gradient")

        return target

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


class VisualVariableBuilder(object):
    @staticmethod
    def get_default():
        return {
            "nodeLabel": {"type": "raw", "attribute": "label"},
            "nodeLabelSize": {"type": "constant", "default": DEFAULT_NODE_LABEL_SIZE},
            "nodeLabelColor": {"type": "constant", "default": DEFAULT_NODE_LABEL_COLOR},
            "nodeColor": {"type": "raw", "attribute": "color", "default": "#999"},
            "nodeColorSaturation": {"type": "disabled"},
            "nodeBorderColor": {"type": "disabled"},
            "nodeBorderRatio": {"type": "disabled"},
            "nodeBorderSize": {"type": "disabled"},
            "nodeSize": {
                "type": "continuous",
                "attribute": "size",
                "range": DEFAULT_NODE_SIZE_RANGE,
            },
            "nodePictogram": {"type": "disabled"},
            "nodePictogramColor": {
                "type": "constant",
                "default": DEFAULT_NODE_PICTOGRAM_COLOR,
            },
            "nodeHaloSize": {"type": "disabled"},
            "nodeHaloColor": {"type": "disabled"},
            "nodeShape": {"type": "disabled"},
            "edgeLabel": {"type": "disabled"},
            "edgeColor": {"type": "raw", "attribute": "color", "default": "#ccc"},
            "edgeSize": {
                "type": "continuous",
                "attribute": "size",
                "range": DEFAULT_EDGE_SIZE_RANGE,
            },
            "edgeCurveness": {"type": "constant", "default": DEFAULT_EDGE_CURVENESS},
        }

    def __init__(self, nodes, edges, is_directed):
        self.nodes = nodes
        self.edges = edges
        self.is_directed = is_directed
        self.variables = VisualVariableBuilder.get_default()

    def build(self):
        return self.variables

    def template(self, name, prefix=None, suffix=None, item_type="node", raw=False):
        return "{}{}_{}{}{}".format(
            "raw_" if raw else "",
            item_type,
            (prefix + "_" if prefix else ""),
            name,
            ("_" + suffix if suffix else ""),
        )

    def build_raw(
        self, name, mapped, raw, default=None, kind="label", variable_prefix=None
    ):
        raw = mapped or raw
        item_type = "node" if name.startswith("node") else "edge"
        items = self.nodes if item_type == "node" else self.edges

        if raw is not None:
            variable = {"type": "raw"}

            variable["attribute"] = resolve_variable(
                self.template(kind, prefix=variable_prefix, item_type=item_type),
                items,
                raw,
                item_type=item_type,
                is_directed=self.is_directed,
            )

            self.variables[name] = variable

        elif default is not None:
            self.variables[name] = {"type": "constant"}

        else:
            self.variables[name] = {"type": "disabled"}

        self.variables[name]["default"] = default

    def build_continuous(
        self,
        name,
        mapped,
        raw,
        default=None,
        kind="size",
        range=None,
        variable_prefix=None,
        scale=None,
    ):
        item_type = "node" if name.startswith("node") else "edge"
        items = self.nodes if item_type == "node" else self.edges

        if raw is not None:
            variable = {"type": "raw"}

            variable["attribute"] = resolve_variable(
                self.template(
                    kind, prefix=variable_prefix, raw=True, item_type=item_type
                ),
                items,
                raw,
                item_type=item_type,
                is_directed=self.is_directed,
            )

            self.variables[name] = variable

        elif mapped is not None:
            range = resolve_range(
                self.template(
                    kind, prefix=variable_prefix, suffix="range", item_type=item_type
                ),
                range,
            )
            variable = {"type": "continuous", "range": range}

            if scale is not None:
                scale = resolve_scale(scale)
                variable["scale"] = scale

            if default is None:
                default = range[0]

            variable["attribute"] = resolve_variable(
                self.template(kind, prefix=variable_prefix, item_type=item_type),
                items,
                mapped,
                item_type=item_type,
                is_directed=self.is_directed,
            )

            self.variables[name] = variable

        elif default is not None:
            self.variables[name] = {"type": "constant"}

        else:
            self.variables[name] = {"type": "disabled"}

        self.variables[name]["default"] = default

    def build_categorical_or_continuous(
        self,
        name,
        mapped,
        raw,
        default=None,
        mapped_from=None,
        kind="color",
        palette=None,
        gradient=None,
        variable_prefix=None,
        scale=None,
    ):
        item_type = "node" if name.startswith("node") else "edge"
        items = self.nodes if item_type == "node" else self.edges

        if mapped is not None:
            variable = {"type": "category"}

            variable["attribute"] = resolve_variable(
                self.template(kind, prefix=variable_prefix, item_type=item_type),
                items,
                mapped,
                item_type=item_type,
                is_directed=self.is_directed,
            )

            self.variables[name] = variable

            if kind != "color":
                variable["kind"] = kind

            if palette is not None:
                palette = resolve_palette(
                    self.template(
                        kind,
                        prefix=variable_prefix,
                        suffix="palette",
                        item_type=item_type,
                    ),
                    palette,
                )

                variable["palette"] = palette

            elif gradient is not None:
                gradient = resolve_range(
                    self.template(
                        kind,
                        prefix=variable_prefix,
                        suffix="gradient",
                        item_type=item_type,
                    ),
                    gradient,
                    allow_named=True,
                )

                variable["type"] = "continuous"
                variable["range"] = gradient

                if scale is not None:
                    scale = resolve_scale(scale)
                    variable["scale"] = scale

                if default is None:
                    default = gradient[0]

        elif mapped_from is not None:
            self.variables[name] = {
                "type": "dependent",
                "value": mapped_from,
            }

        elif raw is not None:
            variable = {"type": "raw"}

            variable["attribute"] = resolve_variable(
                self.template(
                    kind, prefix=variable_prefix, raw=True, item_type=item_type
                ),
                items,
                raw,
                item_type=item_type,
                is_directed=self.is_directed,
            )

            self.variables[name] = variable

        elif default is not None:
            self.variables[name] = {"type": "constant"}

        else:
            self.variables[name] = {"type": "disabled"}

        self.variables[name]["default"] = default
