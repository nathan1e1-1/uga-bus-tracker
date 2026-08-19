#!/usr/bin/env python3
"""
Unit tests for api.py poll_buses enriching the bus cache.

Run: python3 -m unittest test_api_poll.py
"""

import unittest
import os
import sys
import tempfile
import asyncio
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import route_shapes
import api


def make_route_data():
    """Synthetic straight-line route with 3 stops (A at start, C at end)."""
    # A(33.95,-83.40) -> C(33.95,-83.35): ~4616m straight west.
    coords = [(33.95, -83.40), (33.95, -83.35)]
    cum = [0.0, route_shapes.haversine(33.95, -83.40, 33.95, -83.35)]
    total = cum[-1]
    stops = [
        {"stop_id": "S1", "position": 0, "name": "Stop A",
         "latitude": 33.95, "longitude": -83.40},
        {"stop_id": "S2", "position": 1, "name": "Stop B",
         "latitude": 33.95, "longitude": -83.3783},
        {"stop_id": "S3", "position": 2, "name": "Stop C",
         "latitude": 33.95, "longitude": -83.35},
    ]
    return (
        {"R1": coords},
        {"R1": stops},
        {"R1": cum},
        {"R1": total},
        {"R1": {"name": "Route 1", "color": "#FF0000"}},
    )


def make_raw_buses():
    """Raw Passio-style payload with a real busName."""
    return {"buses": {
        "101": [{
            "busId": "101",
            "busName": "R1-07",
            "routeId": "R1",
            "route": "Route 1",
            "latitude": 33.95,
            "longitude": -83.3968,   # ~300m past Stop A
            "calculatedCourse": 90,
        }]
    }}


class TestApiPollEnrichment(unittest.TestCase):

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        route_shapes.HISTORY_FILE = os.path.join(self._tmp.name, "bus_history.json")

        # Hermetic mocks: no network calls.
        route_shapes.load_or_fetch_routes = lambda force_refresh=False: make_route_data()
        route_shapes.fetch_vehicles = lambda: make_raw_buses()
        api.requests.post = lambda url, json=None, timeout=None: (_ for _ in ()).throw(
            AssertionError("network call should not happen")
        )

    def tearDown(self):
        self._tmp.cleanup()

    def test_poll_buses_enriches_with_eta_next_stop_and_name(self):
        asyncio.run(api.poll_buses())

        self.assertIn("101", api.bus_cache)
        bus = api.bus_cache["101"]

        # Real name from Passio busName, not a hardcoded "Unknown"
        self.assertEqual(bus["bus_name"], "R1-07")

        # Where the bus is heading + ETA fields must exist
        self.assertEqual(bus["next_stop"], "Stop B")
        self.assertIn("next_stop_pos", bus)
        self.assertIn("eta_seconds", bus)
        self.assertIn("eta_source", bus)
        self.assertIn("eta_display", bus)
        self.assertIn("speed_source", bus)

        # Raw position preserved
        self.assertAlmostEqual(bus["lat"], 33.95)
        self.assertAlmostEqual(bus["lon"], -83.3968)
        self.assertFalse(bus["is_stale"])

    def test_poll_buses_includes_etas_for_every_stop(self):
        # 2nd poll provides speed history so ETAs become computable
        asyncio.run(api.poll_buses())
        asyncio.run(api.poll_buses())
        bus = api.bus_cache["101"]

        self.assertIn("etas", bus)
        self.assertEqual(sorted(bus["etas"].keys()), ["S1", "S2", "S3"])
        for entry in bus["etas"].values():
            self.assertIn("eta_seconds", entry)
            self.assertIn("eta_display", entry)
            self.assertIn("eta_source", entry)

        # The nearest stop ahead (Stop B) should have the smallest ETA.
        etas = bus["etas"]
        self.assertIsNotNone(etas["S2"]["eta_seconds"])
        sorted_ids = [sid for sid, _ in sorted(etas.items(), key=lambda kv: kv[1]["eta_seconds"] or 0)]
        self.assertEqual(sorted_ids[0], "S2")


if __name__ == "__main__":
    unittest.main(verbosity=2)