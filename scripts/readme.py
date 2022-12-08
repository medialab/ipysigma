from docdocdoc import get_function, template_params

from ipysigma import Sigma, SigmaGrid

sigma_fn = get_function(Sigma)
sigma_grid_fn = get_function(SigmaGrid)

with open("./README.template.md") as f:
    txt = f.read()
    templated = txt % {
        "sigma_args": template_params(sigma_fn),
        "sigma_grid_args": template_params(sigma_grid_fn),
    }

    print(templated.strip())
