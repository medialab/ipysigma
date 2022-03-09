#!/usr/bin/env python
# coding: utf-8

import pytest
import networkx as nx

from ..sigma import Sigma


def test_example_creation_blank():
    w = Sigma(nx.Graph())
    assert w.height == 500
