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


def process_node_gexf_viz(attr):
    if "viz" not in attr:
        return

    viz = attr["viz"]

    # Size
    if "size" in viz and "size" not in attr:
        attr["size"] = viz["size"]

    # Position
    if "position" in viz and "x" not in attr and "y" not in attr:
        pos = viz["position"]

        if "x" in pos:
            attr["x"] = pos["x"]

        if "y" in pos:
            attr["y"] = pos["y"]

    # Color
    if "color" in viz and "color" not in attr:
        attr["color"] = extract_rgba_from_viz(viz["color"])

    del attr["viz"]


def process_edge_gexf_viz(attr):
    if "viz" not in attr:
        return

    viz = attr["viz"]

    # Thickness
    if "thickness" in viz and "size" not in attr:
        attr["size"] = viz["thickness"]

    # Color
    if "color" in viz and "color" not in attr:
        attr["color"] = extract_rgba_from_viz(viz["color"])

    del attr["viz"]
