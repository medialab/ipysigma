from ipysigma.utils import is_partition, is_indexable


class TestUtils(object):
    def test_is_partition(self):
        assert not is_partition({"test": 4})
        assert not is_partition([])
        assert is_partition([[0, 1], [2, 3]])
        assert is_partition([{0, 1}, {2, 3}])

    def test_is_indexable(self):
        assert not is_indexable(None)
        assert not is_indexable(45)
        assert not is_indexable("test")
        assert is_indexable([1, 2, 3])
        assert is_indexable({})
        assert not is_indexable(set())
