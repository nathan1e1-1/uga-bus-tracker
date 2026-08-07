#!/usr/bin/env python3
"""
Unit tests for speed/ETA computation in route_shapes.py

Run: python3 -m unittest test_speed_eta.py
"""

import unittest
from datetime import datetime, timezone, timedelta
import sys
import os

# Ensure route_shapes.py is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from route_shapes import (
    haversine,
    _segment_speed,
    compute_speed,
    compute_eta,
    format_eta,
    STOPPED_SPEED_MPS,
    DEFAULT_MOVING_SPEED_MPS,
    ARRIVAL_THRESHOLD_M,
)


class TestSegmentSpeed(unittest.TestCase):
    """Test the low-level speed between two history entries."""

    def make_entry(self, fetch_time_offset_sec, lat, lon, dist_along, route_id="64018"):
        base = datetime(2026, 8, 6, 20, 0, 0, tzinfo=timezone.utc)
        t = base + timedelta(seconds=fetch_time_offset_sec)
        return {
            "fetch_time": t.isoformat(),
            "lat": lat,
            "lon": lon,
            "dist_along": dist_along,
            "route_id": route_id,
            "bus_name": "TEST",
        }

    def test_segment_speed_with_dist_along(self):
        """Two fixes on same route with dist_along → route-following speed."""
        e1 = self.make_entry(0, 33.0, -83.0, 100.0)
        e2 = self.make_entry(20, 33.001, -83.0, 150.0)
        speed = _segment_speed(e1, e2, total_route_len=1000.0)
        self.assertIsNotNone(speed)
        self.assertAlmostEqual(speed, 2.5, places=2)  # 50m / 20s

    def test_segment_speed_haversine_fallback(self):
        """Missing dist_along → falls back to haversine."""
        e1 = self.make_entry(0, 33.0, -83.0, None)
        e2 = self.make_entry(20, 33.001, -83.0, None)
        speed = _segment_speed(e1, e2, total_route_len=1000.0)
        self.assertIsNotNone(speed)
        # haversine(33.0,-83.0 → 33.001,-83.0) ≈ 111m over 20s ≈ 5.55 m/s
        self.assertGreater(speed, 5.0)

    def test_segment_speed_too_short_delta(self):
        """Time delta < MIN_TIME_DELTA → None."""
        e1 = self.make_entry(0, 33.0, -83.0, 100.0)
        e2 = self.make_entry(5, 33.001, -83.0, 150.0)
        speed = _segment_speed(e1, e2, total_route_len=1000.0)
        self.assertIsNone(speed)

    def test_segment_speed_implausible_snap_falls_to_haversine(self):
        """If dist_along gives > MAX_IMPLAUSIBLE_SPEED_MPS, fall to haversine."""
        e1 = self.make_entry(0, 33.0, -83.0, 100.0)
        e2 = self.make_entry(15, 33.001, -83.0, 900.0)  # 800m in 15s = 53 m/s > 20 m/s
        speed = _segment_speed(e1, e2, total_route_len=1000.0)
        self.assertIsNotNone(speed)
        # Should fall back to haversine, not 53 m/s
        self.assertLess(speed, 50.0)


class TestComputeSpeed(unittest.TestCase):
    """Test median-over-window speed with stopped-bus fallback."""

    def make_entry(self, fetch_time_offset_sec, lat, lon, dist_along, route_id="64018"):
        base = datetime(2026, 8, 6, 20, 0, 0, tzinfo=timezone.utc)
        t = base + timedelta(seconds=fetch_time_offset_sec)
        return {
            "fetch_time": t.isoformat(),
            "lat": lat,
            "lon": lon,
            "dist_along": dist_along,
            "route_id": route_id,
            "bus_name": "TEST",
        }

    def test_live_moving_bus(self):
        """4 fixes all moving → 'live' median speed."""
        entries = [
            self.make_entry(0, 33.0, -83.0, 0.0),
            self.make_entry(20, 33.0, -83.0, 50.0),   # 2.5 m/s
            self.make_entry(40, 33.0, -83.0, 105.0),  # 2.75 m/s
            self.make_entry(60, 33.0, -83.0, 160.0),  # 2.75 m/s
        ]
        speed, source = compute_speed(entries, total_route_len=1000.0)
        self.assertIsNotNone(speed)
        self.assertEqual(source, "live")
        # Median of [2.5, 2.75, 2.75] ≈ 2.75
        self.assertAlmostEqual(speed, 2.75, places=2)

    def test_stopped_bus_uses_pre_stop(self):
        """4 fixes: first 2 moving, last 2 stopped → 'estimated' pre-stop speed."""
        entries = [
            self.make_entry(0, 33.0, -83.0, 0.0),
            self.make_entry(20, 33.0, -83.0, 50.0),   # 2.5 m/s
            self.make_entry(40, 33.0, -83.0, 50.0),   # 0.0 m/s (stopped)
            self.make_entry(60, 33.0, -83.0, 50.0),   # 0.0 m/s (stopped)
        ]
        speed, source = compute_speed(entries, total_route_len=1000.0)
        self.assertIsNotNone(speed)
        self.assertEqual(source, "estimated")
        self.assertAlmostEqual(speed, 2.5, places=2)

    def test_stopped_bus_no_history_uses_default(self):
        """2 fixes both stopped, no pre-stop speed → 'default' campus speed."""
        entries = [
            self.make_entry(0, 33.0, -83.0, 100.0),
            self.make_entry(20, 33.0, -83.0, 100.0),  # 0.0 m/s
        ]
        speed, source = compute_speed(entries, total_route_len=1000.0)
        self.assertIsNotNone(speed)
        self.assertEqual(source, "default")
        self.assertEqual(speed, DEFAULT_MOVING_SPEED_MPS)

    def test_insufficient_history(self):
        """Only 1 fix → None."""
        entries = [self.make_entry(0, 33.0, -83.0, 0.0)]
        speed, source = compute_speed(entries, total_route_len=1000.0)
        self.assertIsNone(speed)
        self.assertIsNone(source)

    def test_median_robustness_one_bad_interval(self):
        """4 fixes with one wild GPS outlier → median discards it."""
        entries = [
            self.make_entry(0, 33.0, -83.0, 0.0),
            self.make_entry(20, 33.0, -83.0, 50.0),   # 2.5 m/s
            self.make_entry(40, 33.0, -83.0, 150.0),  # 5.0 m/s (outlier)
            self.make_entry(60, 33.0, -83.0, 170.0),  # 1.0 m/s
        ]
        speed, source = compute_speed(entries, total_route_len=1000.0)
        self.assertIsNotNone(speed)
        self.assertEqual(source, "live")
        # Median of [2.5, 1.0, 5.0] = 2.5 (sorted: [1.0, 2.5, 5.0])
        self.assertAlmostEqual(speed, 2.5, places=2)


class TestComputeETA(unittest.TestCase):
    """Test ETA computation with quality/source labeling."""

    def test_live_eta(self):
        """Normal moving bus → live ETA in seconds and minutes."""
        secs, mins, source = compute_eta(300.0, 5.0, "live")
        self.assertEqual(secs, 60.0)
        self.assertEqual(mins, 1.0)
        self.assertEqual(source, "live")

    def test_stopped_eta(self):
        """Stopped bus with estimated speed → estimated ETA."""
        secs, mins, source = compute_eta(300.0, 2.5, "estimated")
        self.assertEqual(secs, 120.0)
        self.assertEqual(source, "estimated")

    def test_unavailable(self):
        """No speed → unavailable."""
        secs, mins, source = compute_eta(300.0, None, None)
        self.assertIsNone(secs)
        self.assertEqual(source, "unavailable")


class TestFormatETA(unittest.TestCase):
    """Test human-readable ETA strings with source tagging."""

    def test_format_seconds(self):
        s, src = format_eta(45, 0.75, "live")
        self.assertEqual(s, "45 sec")
        self.assertEqual(src, "live")

    def test_format_minutes(self):
        s, src = format_eta(180, 3.0, "estimated")
        self.assertEqual(s, "3 min")
        self.assertEqual(src, "estimated")

    def test_format_hours(self):
        s, src = format_eta(5400, 90.0, "default")
        self.assertEqual(s, "1 hr 30 min")
        self.assertEqual(src, "default")

    def test_format_unavailable(self):
        s, src = format_eta(None, None, "unavailable")
        self.assertEqual(s, "Unavailable")
        self.assertEqual(src, "unavailable")


class TestArrivalThreshold(unittest.TestCase):
    """Test arrival detection when bus is very close to stop."""

    def test_close_to_stop(self):
        self.assertLess(15.0, ARRIVAL_THRESHOLD_M)
        self.assertGreater(30.0, ARRIVAL_THRESHOLD_M)


if __name__ == "__main__":
    unittest.main(verbosity=2)
