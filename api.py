#!/usr/bin/env python3
"""
FastAPI app for UGA Bus Route Optimizer.

Startup:
  - Creates Postgres schema (bus_state table)
  - Launches background polling task

Endpoints:
  GET /routes/{route_id}/buses  → current bus positions & ETAs for a route
  GET /health                     → liveness check

Background task:
  - Every POLL_INTERVAL_SECONDS, fetches Passio GO, computes speed/ETA,
    upserts into bus_state table.
"""

import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import asyncpg
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from db import init_schema, upsert_bus_state, get_buses_for_route
from route_shapes import poll_and_compute, save_history, load_or_fetch_routes

POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL", "30"))
polling_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB schema + launch background poller."""
    global polling_task
    await init_schema()
    polling_task = asyncio.create_task(poller_loop())
    yield
    # Shutdown
    if polling_task:
        polling_task.cancel()
        try:
            await polling_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="UGA Bus Route Optimizer",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS: allow Vite dev server and deployed Vercel domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STALE_THRESHOLD_SECONDS = 120  # 2 min — treat a bus as stale if not updated recently


async def poller_loop():
    """
    Background task: poll Passio GO and upsert bus_state continuously.

    NOTE: asyncio.sleep() is placed *after* the full work completes.
    This means cycles never overlap even if a single poll is slow.
    (Not a fixed-rate scheduler — work + sleep = period.)
    """
    while True:
        try:
            start = datetime.now(timezone.utc)
            results, history = poll_and_compute()
            await upsert_bus_state(results)
            # TODO: drop disk writes once Postgres is fully trusted as the
            # single source of truth. Kept for now as a safety net.
            save_history(history)
            elapsed = (datetime.now(timezone.utc) - start).total_seconds()
            print(f"[poll] {len(results)} buses, {elapsed:.1f}s")
        except Exception as e:
            print(f"[poll] ERROR: {e}")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


@app.get("/health")
async def health():
    """Liveness probe."""
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


@app.get("/routes/{route_id}/buses")
async def get_route_buses(route_id: str):
    """
    Return current bus state for a given route_id.

    Each bus object includes a computed `is_stale` flag based on
    `updated_at` age, so the frontend never trusts a silently
    stale row.
    """
    rows = await get_buses_for_route(route_id)
    now = datetime.now(timezone.utc)
    for r in rows:
        updated_at = r.get("updated_at")
        if updated_at:
            age = (now - updated_at).total_seconds()
            r["is_stale"] = age > STALE_THRESHOLD_SECONDS
        else:
            r["is_stale"] = True
    if not rows:
        return JSONResponse(content=[], status_code=200)
    return rows


@app.get("/routes/{route_id}/buses/{bus_id}")
async def get_bus(route_id: str, bus_id: str):
    """Single bus lookup (optional convenience endpoint)."""
    rows = await get_buses_for_route(route_id)
    now = datetime.now(timezone.utc)
    for r in rows:
        if r["bus_id"] == bus_id:
            updated_at = r.get("updated_at")
            if updated_at:
                age = (now - updated_at).total_seconds()
                r["is_stale"] = age > STALE_THRESHOLD_SECONDS
            else:
                r["is_stale"] = True
            return r
    raise HTTPException(status_code=404, detail="Bus not found")


@app.get("/routes")
async def list_routes():
    """Return all available routes (names + IDs) for the route picker."""
    route_shapes, stops_by_route, route_cumulative, route_total_len, route_meta = \
        load_or_fetch_routes()
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
    """Return the route polyline and stop list for map rendering."""
    route_shapes, stops_by_route, route_cumulative, route_total_len, route_meta = \
        load_or_fetch_routes()
    coords = route_shapes.get(route_id)
    stops = stops_by_route.get(route_id, [])
    meta = route_meta.get(route_id, {})
    if not coords:
        raise HTTPException(status_code=404, detail="Route not found")
    return {
        "route_id": route_id,
        "route_name": meta.get("name", route_id),
        "color": meta.get("color", "#000000"),
        "polyline": [{"lat": c[0], "lng": c[1]} for c in coords],
        "stops": stops,
        "total_length_m": route_total_len.get(route_id),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
