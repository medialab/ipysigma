from docdocdoc import get_function, template_params

from ipysigma import Sigma, SigmaGrid
from ipysigma.constants import SUPPORTED_NAMED_GRADIENTS, SUPPORTED_NAMED_PALETTES


def format_name_list(l):
    return ", ".join("`{}`".format(i) for i in l)


sigma_fn = get_function(Sigma)
sigma_grid_fn = get_function(SigmaGrid)

with open("./README.template.md") as f:
    txt = f.read()
    templated = txt % {
        "sigma_args": template_params(sigma_fn),
        "sigma_grid_args": template_params(sigma_grid_fn),
        "supported_color_gradients": format_name_list(sorted(SUPPORTED_NAMED_GRADIENTS)),
        "supported_color_palettes": format_name_list(
            p for p in sorted(SUPPORTED_NAMED_PALETTES) if p != "IWantHue"
        ),
    }

    print(templated.strip())
