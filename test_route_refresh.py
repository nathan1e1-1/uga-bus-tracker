#!/usr/bin/env python3
"""
Unit tests for route cache refresh throttling in route_shapes.py

Run: python3 -m unittest test_route_refresh.py
"""

import unittest
import os
import sys
import json
import tempfile
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import route_shapes


def stale_cache_blob():
    return {
        "cached_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        "route_shapes": {"R1": [{"lat": 1.0, "lng": 2.0}]},
        "stops_by_route": {"R1": []},
        "route_cumulative": {"R1": [0.0]},
        "route_total_len": {"R1": 0.0},
        "route_meta": {"R1": {"name": "R1", "color": "#FFFFFF"}},
    }


class TestRouteRefreshThrottle(unittest.TestCase):

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.cache_file = os.path.join(self._tmp.name, "route_cache.json")
        with open(self.cache_file, "w") as f:
            json.dump(stale_cache_blob(), f)

        self._orig_file = route_shapes.ROUTE_CACHE_FILE
        self._orig_attempt = route_shapes.last_refresh_attempt
        route_shapes.ROUTE_CACHE_FILE = self.cache_file
        route_shapes.last_refresh_attempt = None

    def tearDown(self):
        route_shapes.ROUTE_CACHE_FILE = self._orig_file
        route_shapes.last_refresh_attempt = self._orig_attempt
        self._tmp.cleanup()

    def test_stale_cache_refresh_is_throttled_on_failure(self):
        calls = {"n": 0}

        def boom(*a, **k):
            calls["n"] += 1
            raise RuntimeError("Passio GO throttled")

        route_shapes._fetch_and_build_cache = boom

        # First call: stale cache -> one refresh attempt -> falls back to stale cache.
        result1 = route_shapes.load_or_fetch_routes()
        self.assertEqual(calls["n"], 1)
        self.assertIn("R1", result1[0])

        # Immediate second call must NOT hammer Passio again; use stale cache.
        result2 = route_shapes.load_or_fetch_routes()
        self.assertEqual(calls["n"], 1)
        self.assertIn("R1", result2[0])


if __name__ == "__main__":
    unittest.main(verbosity=2)