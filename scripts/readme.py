import re
from docdocdoc import get_function, template_params

from ipysigma import Sigma, SigmaGrid
from ipysigma.constants import SUPPORTED_NAMED_GRADIENTS, SUPPORTED_NAMED_PALETTES

TEMPLATE_RE = re.compile(r"<%\s+([A-Za-z/\-\_]+)\s+%>")

def format_name_list(l):
    return ", ".join("`{}`".format(i) for i in l)

def template_readme(tpl, replace_targets):

    def replacer(match):
        key = match.group(1)
        return replace_targets[key]

    return re.sub(TEMPLATE_RE, replacer, tpl)

sigma_fn = get_function(Sigma)
sigma_grid_fn = get_function(SigmaGrid)

replace_targets = {
    "sigma_args": template_params(sigma_fn),
    "sigma_grid_args": template_params(sigma_grid_fn),
    "supported_color_gradients": format_name_list(sorted(SUPPORTED_NAMED_GRADIENTS)),
    "supported_color_palettes": format_name_list(
        p for p in sorted(SUPPORTED_NAMED_PALETTES) if p != "IWantHue"
    ),
}

with open("./README.template.md") as f:
    txt = f.read()
    templated = template_readme(txt, replace_targets)

    print(templated.strip())
