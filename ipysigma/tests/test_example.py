#!/usr/bin/env python
# coding: utf-8

# Copyright (c) Yomguithereal.
# Distributed under the terms of the Modified BSD License.

import pytest
import networkx as nx

from ..sigma import Sigma


def test_example_creation_blank():
    w = Sigma(nx.Graph())
    assert w.height == 500
