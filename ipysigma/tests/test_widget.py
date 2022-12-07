#!/usr/bin/env python
# coding: utf-8
import networkx as nx

from ipysigma import Sigma


class TestSigmaWidget(object):
    def test_default(self):
        w = Sigma(nx.Graph())
        assert w.height == "500px"
