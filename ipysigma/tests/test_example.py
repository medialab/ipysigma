#!/usr/bin/env python
# coding: utf-8

# Copyright (c) Yomguithereal.
# Distributed under the terms of the Modified BSD License.

import pytest

from ..sigma import Sigma


def test_example_creation_blank():
    w = Sigma()
    assert w.value == 'Hello World'
