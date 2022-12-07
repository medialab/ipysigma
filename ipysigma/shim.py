try:
    import numpy as np
except ImportError:
    np = None

try:
    import pandas as pd
except ImportError:
    pd = None

import math
from numbers import Number


def is_nan(v) -> bool:
    if not isinstance(v, Number):
        return False

    if math.isnan(v):
        return True

    if pd is not None and pd.isna(v):
        return True

    if np is not None and np.isnan(v):
        return True

    return False
