#!/usr/bin/env python3
"""
UGA Route Shape, Speed & ETA Calculator

Architecture:
- Static route data (shapes, stops, cumulative distances) is cached to disk
  and only refreshed every 24 hours (or on explicit --refresh flag).
- Live bus positions are polled every run.
- Each bus position is projected onto its route polyline, producing a
  distance-along-route (dist_along).  This dist_along is persisted in
  bus_history.json.
- Recent speed is computed from dist_along deltas, which correctly handles
  loop routes (raw haversine would under-estimate distance when the bus
  wraps around a loop).
- "Distance remaining to next stop" and ETA are computed from the route
  polyline and recent average speed.
- Static-schedule fallback is wired but currently returns None because
  Passio GO returns routeSchedules as a stub.

Polyline projection edge cases handled:
- Loop routes:  prev_dist_along constrains the search to segments near the
  previous fix, preventing snapping to an earlier pass of the loop.
- Overlapping / bidirectional segments:  same fix — the bus can't jump
  discontinuously along the route between consecutive polls.
- Stale / missing history:  falls back to global closest-segment search.
"""

import argparse
import json
import math
import os
import requests
import sys
from datetime import datetime, timezone, timedelta

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_URL = "https://passiogo.com"
UGA_SYSTEM_ID = 3994
DATA_DIR = "route_data"
ROUTE_CACHE_FILE = os.path.join(DATA_DIR, "route_cache.json")
HISTORY_FILE = os.path.join(DATA_DIR, "bus_history.json")

ROUTE_CACHE_TTL_SECONDS = 86400          # refresh shapes once a day
HISTORY_TTL_SECONDS = 1800               # keep 30 min of position fixes
MIN_TIME_DELTA = 10                      # minimum seconds between fixes for speed
MAX_IMPLAUSIBLE_SPEED_MPS = 20.0         # 45 mph — generous but realistic for a campus shuttle
REFRESH_RETRY_INTERVAL_SECONDS = 600     # backoff before retrying a failed Passio refresh

# Speed / ETA behaviour
SPEED_WINDOW = 4                         # fixes to average over for live speed
WIDER_WINDOW = 8                         # fixes to scan for pre-stop speed
STOPPED_SPEED_MPS = 1.0                  # below this = "stopped"
DEFAULT_MOVING_SPEED_MPS = 4.0           # ~9 mph — typical campus shuttle cruise
ARRIVAL_THRESHOLD_M = 25.0               # within this = "Arriving"

# Timestamp of the last route-cache refresh attempt (for backoff throttling).
last_refresh_attempt = None

# ---------------------------------------------------------------------------
# Geo helpers
# ---------------------------------------------------------------------------

def haversine(lat1, lon1, lat2, lon2):
    """Great-circle distance in meters."""
    R = 6_371_000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlamb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlamb / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def closest_point_on_segment(px, py, ax, ay, bx, by):
    """
    Orthogonal projection of point P onto segment AB.
    Returns (cx, cy, t, distance_m) where t in [0,1].
    """
    dx = bx - ax
    dy = by - ay
    if dx == 0 and dy == 0:
        return ax, ay, 0.0, haversine(px, py, ax, ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    cx = ax + t * dx
    cy = ay + t * dy
    return cx, cy, t, haversine(px, py, cx, cy)


# ---------------------------------------------------------------------------
# Route cache (fetch once, refresh daily)
# ---------------------------------------------------------------------------

def _extract_from_cache(cache):
    """Turn JSON-safe cache back into runtime structures."""
    route_shapes = {
        rid: [(p["lat"], p["lng"]) for p in coords]
        for rid, coords in cache["route_shapes"].items()
    }
    return (
        route_shapes,
        cache["stops_by_route"],
        cache["route_cumulative"],
        cache["route_total_len"],
        cache.get("route_meta", {}),
    )


def _save_route_cache(cache):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(ROUTE_CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)


def _fetch_and_build_cache():
    """Hit Passio GO getStops=2, parse shapes / stops, precompute cumulative distances."""
    url = f"{BASE_URL}/mapGetData.php?getStops=2"
    body = {"s0": str(UGA_SYSTEM_ID), "sA": 1}
    resp = requests.post(url, json=body, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    # --- parse shapes ---
    route_shapes = {}
    if "routePoints" in data:
        for rid, pts_list in data["routePoints"].items():
            if pts_list and len(pts_list) > 0:
                route_shapes[rid] = [
                    (float(p["lat"]), float(p["lng"])) for p in pts_list[0]
                ]

    # --- parse stops ---
    stops_by_route = {}
    all_stops = data.get("stops", {})
    routes_meta = data.get("routes", {})
    for rid, route_info in routes_meta.items():
        stops_by_route[rid] = []
        for entry in route_info[2:]:
            pos, stop_id_raw = entry[0], entry[1]
            key = f"ID{stop_id_raw}"
            if key in all_stops:
                s = all_stops[key]
                stops_by_route[rid].append({
                    "stop_id": stop_id_raw,
                    "position": int(pos),
                    "name": s.get("name"),
                    "latitude": float(s.get("latitude")),
                    "longitude": float(s.get("longitude")),
                })
        stops_by_route[rid].sort(key=lambda s: s["position"])

    # --- precompute cumulative distances for every route ---
    route_cumulative = {}
    route_total_len = {}
    for rid, coords in route_shapes.items():
        cum = [0.0]
        for i in range(len(coords) - 1):
            d = haversine(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1])
            cum.append(cum[-1] + d)
        route_cumulative[rid] = cum
        route_total_len[rid] = cum[-1]

    # --- parse route metadata (names, colors) ---
    route_meta = {}
    group_routes = data.get("groupRoutes", {})
    system_routes = group_routes.get(str(UGA_SYSTEM_ID), {})
    for rid, info in system_routes.items():
        route_meta[rid] = {
            "name": info.get("name", rid),
            "color": info.get("color", "#000000"),
            "route_group_id": info.get("routeGroupId"),
        }

    cache = {
        "cached_at": datetime.now(timezone.utc).isoformat(),
        "route_shapes": {
            rid: [{"lat": c[0], "lng": c[1]} for c in coords]
            for rid, coords in route_shapes.items()
        },
        "stops_by_route": stops_by_route,
        "route_cumulative": route_cumulative,
        "route_total_len": route_total_len,
        "route_meta": route_meta,
    }
    _save_route_cache(cache)
    return route_shapes, stops_by_route, route_cumulative, route_total_len, route_meta


def load_or_fetch_routes(force_refresh=False):
    """
    Load cached route data if fresh; otherwise fetch from Passio GO.
    Falls back to stale cache if the live fetch fails.

    Refresh attempts are throttled so a failing Passio GO refresh (e.g. a
    rate limit) is retried at most once per REFRESH_RETRY_INTERVAL_SECONDS,
    instead of on every poll cycle.
    """
    global last_refresh_attempt

    cache = None
    status = "missing"

    if os.path.exists(ROUTE_CACHE_FILE) and not force_refresh:
        try:
            with open(ROUTE_CACHE_FILE, "r") as f:
                cache = json.load(f)
            cached_at = datetime.fromisoformat(cache["cached_at"])
            age = (datetime.now(timezone.utc) - cached_at).total_seconds()
            status = "fresh" if age <= ROUTE_CACHE_TTL_SECONDS else "stale"
        except (KeyError, ValueError, json.JSONDecodeError, IOError):
            cache = None
            status = "missing"

    if status == "fresh" and not force_refresh:
        print("Using cached route data (refresh if >24h old).")
        return _extract_from_cache(cache)

    # Backoff: if the last refresh attempt was recent, serve the stale cache
    # rather than hammering Passio GO every poll.
    now = datetime.now(timezone.utc)
    last = last_refresh_attempt
    if (not force_refresh and cache is not None and last is not None and
            (now - last).total_seconds() < REFRESH_RETRY_INTERVAL_SECONDS):
        print("Route cache refresh throttled — using cached route data.")
        return _extract_from_cache(cache)

    print("Route cache stale or missing — fetching from Passio GO...")
    try:
        last_refresh_attempt = now
        return _fetch_and_build_cache()
    except Exception as e:
        print(f"ERROR fetching route data: {e}")
        if cache is not None:
            print("WARNING: falling back to stale route cache.")
            return _extract_from_cache(cache)
        raise


# ---------------------------------------------------------------------------
# Live vehicles
# ---------------------------------------------------------------------------

def fetch_vehicles():
    url = f"{BASE_URL}/mapGetData.php?getBuses=2"
    body = {"s0": str(UGA_SYSTEM_ID), "sA": 1}
    resp = requests.post(url, json=body, timeout=30)
    resp.raise_for_status()
    return resp.json()


def parse_vehicles(raw):
    vehicles = []
    for vid, vlist in raw.get("buses", {}).items():
        if vid == "-1" or not vlist:
            continue
        v = vlist[0]
        vehicles.append({
            "bus_id": str(v.get("busId")),
            "bus_name": v.get("busName"),
            "route_id": v.get("routeId"),
            "route_name": v.get("route"),
            "latitude": float(v.get("latitude", 0)),
            "longitude": float(v.get("longitude", 0)),
            "course": v.get("calculatedCourse"),
        })
    return vehicles


# ---------------------------------------------------------------------------
# Polyline projection (loop-safe)
# ---------------------------------------------------------------------------

def find_closest_point_on_route(lat, lon, route_coords, route_cumulative, total_len,
                                 prev_dist_along=None, max_forward_m=None):
    """
    Project a point onto the route polyline.

    If prev_dist_along and max_forward_m are provided, we reject any segment
    that is farther forward along the route than the bus could plausibly have
    travelled since the previous fix.  This prevents snapping to the wrong pass
    of a loop or to an overlapping bidirectional segment.
    """
    candidates = []
    for i in range(len(route_coords) - 1):
        ax, ay = route_coords[i]
        bx, by = route_coords[i + 1]
        cx, cy, t, perp = closest_point_on_segment(lat, lon, ax, ay, bx, by)
        seg_len = route_cumulative[i + 1] - route_cumulative[i]
        dist_along = route_cumulative[i] + t * seg_len
        candidates.append({
            "seg_idx": i, "seg_t": t,
            "point": (cx, cy),
            "perp_dist": perp,
            "dist_along": dist_along,
        })

    if prev_dist_along is not None and total_len > 0 and max_forward_m is not None:
        # Hard filter: bus can't teleport forward along the route.
        # Soft penalty: prefer segments closer to previous fix (reduces
        # snap-to-wrong-pass when the loop crosses near itself).
        for c in candidates:
            forward = (c["dist_along"] - prev_dist_along) % total_len
            if forward > max_forward_m:
                c["score"] = float("inf")
            else:
                c["score"] = c["perp_dist"] + forward * 0.15

        valid = [c for c in candidates if c["score"] != float("inf")]
        if valid:
            best = min(valid, key=lambda c: c["score"])
        else:
            # Every segment rejected (bus possibly off-route or polyline gap)
            best = min(candidates, key=lambda c: c["perp_dist"])
    else:
        best = min(candidates, key=lambda c: c["perp_dist"])

    return (best["seg_idx"], best["seg_t"], best["point"],
            best["perp_dist"], best["dist_along"])


# ---------------------------------------------------------------------------
# Distance to next stop
# ---------------------------------------------------------------------------

def distance_to_next_stop(v_dist_along, route_id, route_shapes, stops_by_route,
                          route_cumulative, route_total_len):
    """Given the vehicle's distance-along-route, compute forward metres to next stop."""
    if route_id not in route_shapes or route_id not in stops_by_route:
        return None, None

    coords = route_shapes[route_id]
    stops = stops_by_route[route_id]
    cum = route_cumulative[route_id]
    total = route_total_len[route_id]

    if len(coords) < 2 or not stops:
        return None, None

    # Project every stop once; pick the one with smallest positive forward distance
    stop_dists = []
    for stop in stops:
        _, _, _, _, s_dist = find_closest_point_on_route(
            stop["latitude"], stop["longitude"], coords, cum, total
        )
        stop_dists.append({**stop, "dist_along": s_dist})

    best_stop = None
    best_forward = float('inf')
    for sd in stop_dists:
        forward = (sd["dist_along"] - v_dist_along) % total
        if 0 < forward < best_forward:
            best_forward = forward
            best_stop = sd

    return best_stop, best_forward


# ---------------------------------------------------------------------------
# Bus history (position fixes, with dist_along)
# ---------------------------------------------------------------------------

def load_history():
    if not os.path.exists(HISTORY_FILE):
        return {}
    try:
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def save_history(history):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)


def update_bus_history(history, bus_id, bus_name, route_id, lat, lon,
                       fetch_time_iso, dist_along=None):
    entry = {
        "fetch_time": fetch_time_iso,
        "lat": lat,
        "lon": lon,
        "route_id": route_id,
        "bus_name": bus_name,
        "dist_along": dist_along,
    }
    history.setdefault(bus_id, []).append(entry)
    # Prune old
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=HISTORY_TTL_SECONDS)).isoformat()
    history[bus_id] = [e for e in history[bus_id] if e["fetch_time"] >= cutoff]
    # Cap at last 20 fixes
    history[bus_id] = history[bus_id][-20:]
    return history


# ---------------------------------------------------------------------------
# Speed & ETA
# ---------------------------------------------------------------------------

def _segment_speed(e1, e2, total_route_len):
    """
    Speed between two consecutive history entries.
    Uses dist_along deltas (route-following) when available;
    falls back to haversine when not.
    Returns None if time delta is too small.
    """
    t1 = datetime.fromisoformat(e1["fetch_time"])
    t2 = datetime.fromisoformat(e2["fetch_time"])
    delta_seconds = (t2 - t1).total_seconds()
    if delta_seconds < MIN_TIME_DELTA:
        return None

    same_route = e1.get("route_id") == e2.get("route_id")
    have_dist = (e1.get("dist_along") is not None and
                 e2.get("dist_along") is not None and
                 total_route_len is not None)

    if same_route and have_dist:
        delta_dist = (e2["dist_along"] - e1["dist_along"]) % total_route_len
        raw_speed = delta_dist / delta_seconds if delta_seconds > 0 else 0
        if raw_speed > MAX_IMPLAUSIBLE_SPEED_MPS:
            dist_m = haversine(e1["lat"], e1["lon"], e2["lat"], e2["lon"])
        else:
            dist_m = delta_dist
    else:
        dist_m = haversine(e1["lat"], e1["lon"], e2["lat"], e2["lon"])

    return dist_m / delta_seconds


def compute_speed(history_entries, total_route_len):
    """
    Median speed over the last SPEED_WINDOW fixes.

    Returns (speed_mps, source) where source is:
      "live"     — bus is moving, median over recent window
      "estimated" — bus appears stopped; using pre-stop speed from wider window
      "default"  — no usable history; using typical campus shuttle speed
      None       — insufficient history (< 2 fixes)
    """
    if len(history_entries) < 2:
        return None, None

    # 1. Try live median over SPEED_WINDOW
    speeds = []
    start = max(1, len(history_entries) - SPEED_WINDOW)
    for i in range(start, len(history_entries)):
        s = _segment_speed(history_entries[i - 1], history_entries[i], total_route_len)
        if s is not None:
            speeds.append(s)

    if speeds:
        speeds.sort()
        median = speeds[len(speeds) // 2]
        if median >= STOPPED_SPEED_MPS:
            return median, "live"

    # 2. Bus appears stopped — scan wider window for pre-stop speed.
    #    We take the median of segments where the bus was actually moving,
    #    ignoring the stopped intervals.
    moving_speeds = []
    for i in range(1, len(history_entries)):
        s = _segment_speed(history_entries[i - 1], history_entries[i], total_route_len)
        if s is not None and s >= STOPPED_SPEED_MPS:
            moving_speeds.append(s)

    if moving_speeds:
        moving_speeds.sort()
        pre_stop = moving_speeds[len(moving_speeds) // 2]
        return pre_stop, "estimated"

    # 3. No usable history — default campus shuttle speed
    return DEFAULT_MOVING_SPEED_MPS, "default"


def compute_eta(distance_m, speed_mps, speed_source):
    """
    Compute ETA.  Returns (seconds, minutes, eta_source).
    eta_source mirrors speed_source unless bus is at the stop.
    """
    if distance_m is None or speed_mps is None or speed_mps <= 0.1:
        return None, None, "unavailable"
    seconds = distance_m / speed_mps
    minutes = seconds / 60.0
    return seconds, minutes, speed_source


def format_eta(seconds, minutes, eta_source):
    """Human-friendly ETA string, preserving source for UI coloring."""
    if seconds is None:
        return "Unavailable", eta_source
    if seconds < 60:
        return f"{int(seconds)} sec", eta_source
    if minutes < 60:
        return f"{int(minutes)} min", eta_source
    hrs = int(minutes // 60)
    mins = int(minutes % 60)
    return f"{hrs} hr {mins} min", eta_source


# ---------------------------------------------------------------------------
# Static schedule fallback (placeholder)
# ---------------------------------------------------------------------------

def get_schedule_fallback_eta(route_id, stop_position, stops_by_route):
    """
    TODO: wire to GTFS or a real schedule endpoint when available.
    Passio GO currently returns routeSchedules as {'stub': '...'}.
    """
    return None


# ---------------------------------------------------------------------------
# Poll-and-compute (shared by CLI and FastAPI background task)
# ---------------------------------------------------------------------------

def poll_and_compute(force_refresh=False):
    """
    One full poll cycle:
      1. Load/fetch route data
      2. Fetch live vehicles
      3. Project onto polylines, compute speed, distance, ETA
      4. Update in-memory history
      5. Return list of bus state dicts (does NOT print or save to DB)

    Returns:
      (results, history) where results is a list of dicts suitable for
      inserting into bus_state, and history is the updated in-memory
      history dict (caller should persist if desired).
    """
    now = datetime.now(timezone.utc)
    fetch_time_iso = now.isoformat()

    route_shapes, stops_by_route, route_cumulative, route_total_len, _ = \
        load_or_fetch_routes(force_refresh=force_refresh)

    history = load_history()
    raw_vehicles = fetch_vehicles()
    vehicles = parse_vehicles(raw_vehicles)

    results = []

    for bus in vehicles:
        rid = bus["route_id"]
        coords = route_shapes.get(rid)
        cum = route_cumulative.get(rid)
        total = route_total_len.get(rid)

        if not coords or not cum:
            continue

        bus_history = history.get(bus["bus_id"], [])
        prev_entry = bus_history[-1] if bus_history else None
        prev_dist_along = prev_entry.get("dist_along") if prev_entry else None

        if prev_entry:
            prev_time = datetime.fromisoformat(prev_entry["fetch_time"])
            delta_seconds = max(1.0, (now - prev_time).total_seconds())
            max_forward_m = 18.0 * delta_seconds + 50.0
        else:
            max_forward_m = None

        # Project onto route
        _, _, _, _, v_dist_along = find_closest_point_on_route(
            bus["latitude"], bus["longitude"], coords, cum, total,
            prev_dist_along=prev_dist_along, max_forward_m=max_forward_m
        )

        # Persist fix with dist_along
        history = update_bus_history(
            history, bus["bus_id"], bus["bus_name"], rid,
            bus["latitude"], bus["longitude"], fetch_time_iso,
            dist_along=v_dist_along
        )

        # Distance to next stop
        next_stop, dist_m = distance_to_next_stop(
            v_dist_along, rid, route_shapes, stops_by_route,
            route_cumulative, route_total_len
        )

        # Speed
        bus_history = history.get(bus["bus_id"], [])
        speed_mps, speed_source = compute_speed(bus_history, total)

        # ETA
        if (next_stop and dist_m is not None and
                dist_m < ARRIVAL_THRESHOLD_M and
                speed_source in ("estimated", "default")):
            eta_seconds, eta_minutes, eta_source = 0, 0, "arriving"
        else:
            eta_seconds, eta_minutes, eta_source = compute_eta(dist_m, speed_mps, speed_source)
            if speed_mps is None and next_stop:
                sched = get_schedule_fallback_eta(rid, next_stop["position"], stops_by_route)
                if sched:
                    eta_seconds, eta_minutes = sched, sched / 60.0
                    eta_source = "schedule"

        eta_str, _ = format_eta(eta_seconds, eta_minutes, eta_source)

        # ETAs to EVERY stop on the route (drives the "Where to?" leaderboard)
        etas = {}
        for stop in stops_by_route.get(rid, []):
            _, _, _, _, s_dist = find_closest_point_on_route(
                stop["latitude"], stop["longitude"], coords, cum, total
            )
            forward = (s_dist - v_dist_along) % total
            if speed_mps is None or speed_mps <= 0.1:
                e_sec, e_min, e_src = None, None, "unavailable"
            else:
                e_sec, e_min, e_src = compute_eta(forward, speed_mps, speed_source)
            e_str, _ = format_eta(e_sec, e_min, e_src)
            etas[str(stop["stop_id"])] = {
                "eta_seconds": e_sec,
                "eta_display": e_str,
                "eta_source": e_src,
            }

        results.append({
            "bus_id": bus["bus_id"],
            "route_id": rid,
            "bus_name": bus.get("bus_name"),
            "lat": bus["latitude"],
            "lon": bus["longitude"],
            "dist_along": v_dist_along,
            "speed": speed_mps,
            "speed_source": speed_source,
            "next_stop": next_stop["name"] if next_stop else None,
            "next_stop_pos": next_stop["position"] if next_stop else None,
            "eta_seconds": eta_seconds,
            "eta_source": eta_source,
            "eta_display": eta_str,
            "etas": etas,
        })

    return results, history


# ---------------------------------------------------------------------------
# Main (CLI)
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="UGA bus speed & ETA calculator")
    parser.add_argument("--refresh-routes", action="store_true",
                        help="Force a fresh fetch of route shapes/stops")
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    print("=" * 70)
    print("UGA Route Shape, Speed & ETA Calculator")
    print(f"Time: {now.isoformat()}")
    print("=" * 70)

    print("\n[1/3] Loading route data...")
    route_shapes, stops_by_route, route_cumulative, route_total_len, _ = \
        load_or_fetch_routes(force_refresh=args.refresh_routes)
    print(f"  Routes: {len(route_shapes)} | Stops: {len(stops_by_route)}")

    print("\n[2/3] Polling & computing...")
    results, history = poll_and_compute(force_refresh=args.refresh_routes)
    print(f"  Processed {len(results)} bus(es)")

    print("\n[3/3] Results:")
    print("-" * 70)
    for r in results:
        print(f"\nBus {r['bus_name']} (Route: {r['route_id']})")
        print(f"  Position: ({r['lat']:.6f}, {r['lon']:.6f})")
        print(f"  Dist-along-route: {r['dist_along']:.1f} m")
        if r['next_stop']:
            print(f"  Next Stop: {r['next_stop']} (pos {r['next_stop_pos']})")
        speed = r['speed']
        if speed is not None:
            print(f"  Speed: {speed:.2f} m/s ({r['speed_source']})")
        else:
            print(f"  Speed: N/A ({r['speed_source']})")
        print(f"  ETA: {r['eta_display']} ({r['eta_source']})")

    print("\n" + "=" * 70)
    print("Saving state...")
    save_history(history)
    print(f"  Bus history → {HISTORY_FILE}")
    print(f"  Route cache → {ROUTE_CACHE_FILE}")
    print("=" * 70)


if __name__ == "__main__":
    main()
