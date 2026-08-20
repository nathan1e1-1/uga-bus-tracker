#!/usr/bin/env python3
"""Tests for the /stops endpoint including per-route stop positions.

Run: python3 -m unittest test_stops_endpoint.py
"""

import unittest
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import api


class TestStopsRoutePositions(unittest.TestCase):

    def setUp(self):
        # Deterministic 2-route, 2-stop dataset.
        api.stops_by_route = {
            "R1": [
                {"stop_id": "A", "position": 1, "name": "Stop A",
                 "latitude": 33.95, "longitude": -83.40},
                {"stop_id": "B", "position": 2, "name": "Stop B",
                 "latitude": 33.95, "longitude": -83.36},
            ],
            "R2": [
                {"stop_id": "A", "position": 3, "name": "Stop A",
                 "latitude": 33.95, "longitude": -83.40},
                {"stop_id": "C", "position": 4, "name": "Stop C",
                 "latitude": 33.96, "longitude": -83.35},
            ],
        }

    def test_stop_includes_route_positions(self):
        stops = api.build_stops_list()
        by_id = {s["stop_id"]: s for s in stops}

        # Stop A is at position 1 on R1 and position 3 on R2.
        self.assertIn("route_positions", by_id["A"])
        self.assertEqual(by_id["A"]["route_positions"], {"R1": 1, "R2": 3})

        # Stop B only on R1, position 2.
        self.assertEqual(by_id["B"]["route_positions"], {"R1": 2})

        # Route ids still present for compatibility.
        self.assertIn("R1", by_id["A"]["route_ids"])
        self.assertIn("R2", by_id["A"]["route_ids"])


if __name__ == "__main__":
    unittest.main(verbosity=2)