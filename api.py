#!/usr/bin/env python3
"""
Simplified FastAPI backend for UGA Bus Tracker.
No database required - uses in-memory + file-based caching.
"""

import asyncio
import json
import os
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests

# Config
UGA_SYSTEM_ID = 3994
BASE_URL = "https://passiogo.com"
DATA_DIR = "route_data"
ROUTE_CACHE_FILE = os.path.join(DATA_DIR, "route_cache.json")
POLL_INTERVAL = 30  # seconds

# In-memory bus state
bus_cache = {}
last_poll_time = None
polling_active = False

# Load route data
route_shapes = {}
stops_by_route = {}
route_meta = {}
route_total_len = {}

def load_routes():
    """Load cached route data."""
    global route_shapes, stops_by_route, route_meta, route_total_len
    if os.path.exists(ROUTE_CACHE_FILE):
        with open(ROUTE_CACHE_FILE, 'r') as f:
            cache = json.load(f)
        route_shapes_raw = cache.get('route_shapes', {})
        route_shapes = {
            rid: [(p['lat'], p['lng']) for p in coords]
            for rid, coords in route_shapes_raw.items()
        }
        stops_by_route = cache.get('stops_by_route', {})
        route_meta = cache.get('route_meta', {})
        route_total_len = cache.get('route_total_len', {})
        print(f"[startup] Loaded {len(route_shapes)} routes")
    else:
        print("[startup] No route cache found!")

async def poll_buses():
    """Poll Passio GO for live bus positions."""
    global bus_cache, last_poll_time
    try:
        url = f"{BASE_URL}/mapGetData.php?getBuses=2"
        resp = requests.post(url, json={"s0": str(UGA_SYSTEM_ID), "sA": 1}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        
        buses = data.get("buses", {})
        bus_cache = {}
        for vid, vlist in buses.items():
            if vid == "-1" or not vlist:
                continue
            v = vlist[0]
            bus_cache[str(v.get('id', vid))] = {
                "bus_id": str(v.get('id', vid)),
                "bus_name": v.get('name', 'Unknown'),
                "route_id": str(v.get('routeId', '')),
                "lat": float(v.get('latitude', 0)),
                "lon": float(v.get('longitude', 0)),
                "heading": v.get('calculatedCourse', v.get('course', 0)),
                "speed": float(v.get('speed', 0)),
                "timestamp": v.get('timestamp', datetime.now(timezone.utc).isoformat()),
                "is_stale": False,
            }
        last_poll_time = datetime.now(timezone.utc)
        print(f"[poll] {len(bus_cache)} buses active")
    except Exception as e:
        print(f"[poll] ERROR: {e}")

async def poller_loop():
    """Background polling task."""
    global polling_active
    polling_active = True
    while polling_active:
        await poll_buses()
        await asyncio.sleep(POLL_INTERVAL)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: load routes + launch poller."""
    load_routes()
    asyncio.create_task(poller_loop())
    yield
    global polling_active
    polling_active = False

app = FastAPI(
    title="UGA Bus Tracker API",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS: allow all origins (no credentials since we use wildcard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "buses_cached": len(bus_cache),
        "last_poll": last_poll_time.isoformat() if last_poll_time else None,
    }

@app.get("/routes")
async def list_routes():
    routes = []
    for rid in sorted(route_shapes.keys()):
        meta = route_meta.get(rid, {})
        stops = stops_by_route.get(rid, [])
        routes.append({
            "route_id": rid,
            "route_name": meta.get("name", rid),
            "color": meta.get("color", "#000000"),
            "stop_count": len(stops),
            "total_length_m": route_total_len.get(rid),
        })
    return routes

@app.get("/routes/{route_id}/shape")
async def get_route_shape(route_id: str):
    coords = route_shapes.get(route_id)
    stops = stops_by_route.get(route_id, [])
    meta = route_meta.get(route_id, {})
    if not coords:
        return {"error": "Route not found"}
    return {
        "route_id": route_id,
        "route_name": meta.get("name", route_id),
        "color": meta.get("color", "#000000"),
        "polyline": [{"lat": c[0], "lng": c[1]} for c in coords],
        "stops": stops,
        "total_length_m": route_total_len.get(route_id),
    }

@app.get("/routes/{route_id}/buses")
async def get_route_buses(route_id: str):
    """Return buses for a specific route."""
    route_buses = [
        bus for bus in bus_cache.values()
        if bus["route_id"] == route_id
    ]
    return route_buses

@app.get("/buses")
async def get_all_buses():
    """Return all active buses."""
    return list(bus_cache.values())

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
