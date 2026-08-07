"""
PostgreSQL database layer for bus_state table.
"""

import os
import asyncpg
from datetime import datetime, timezone

# Allow DATABASE_URL override via env var; default to a local dev Postgres
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/uga_buses"
)

_pool = None


async def get_pool():
    """Lazy-initialize the asyncpg connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    return _pool


async def init_schema():
    """Create bus_state table if it doesn't exist."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS bus_state (
                bus_id        TEXT PRIMARY KEY,
                route_id      TEXT NOT NULL,
                bus_name      TEXT,
                lat           DOUBLE PRECISION,
                lon           DOUBLE PRECISION,
                dist_along    DOUBLE PRECISION,
                speed         DOUBLE PRECISION,
                speed_source  TEXT,
                next_stop     TEXT,
                next_stop_pos INTEGER,
                eta_seconds   DOUBLE PRECISION,
                eta_source    TEXT,
                updated_at    TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_bus_state_route_id
                ON bus_state(route_id);
            CREATE INDEX IF NOT EXISTS idx_bus_state_updated_at
                ON bus_state(updated_at);
            """
        )


async def upsert_bus_state(rows):
    """
    Upsert a list of bus_state rows.
    Each row is a dict with keys matching the table columns.
    """
    if not rows:
        return

    pool = await get_pool()
    now = datetime.now(timezone.utc)

    async with pool.acquire() as conn:
        for row in rows:
            await conn.execute(
                """
                INSERT INTO bus_state (
                    bus_id, route_id, bus_name, lat, lon,
                    dist_along, speed, speed_source,
                    next_stop, next_stop_pos,
                    eta_seconds, eta_source, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (bus_id) DO UPDATE SET
                    route_id      = EXCLUDED.route_id,
                    bus_name      = EXCLUDED.bus_name,
                    lat           = EXCLUDED.lat,
                    lon           = EXCLUDED.lon,
                    dist_along    = EXCLUDED.dist_along,
                    speed         = EXCLUDED.speed,
                    speed_source  = EXCLUDED.speed_source,
                    next_stop     = EXCLUDED.next_stop,
                    next_stop_pos = EXCLUDED.next_stop_pos,
                    eta_seconds   = EXCLUDED.eta_seconds,
                    eta_source    = EXCLUDED.eta_source,
                    updated_at    = EXCLUDED.updated_at
                """,
                row["bus_id"],
                row["route_id"],
                row.get("bus_name"),
                row.get("lat"),
                row.get("lon"),
                row.get("dist_along"),
                row.get("speed"),
                row.get("speed_source"),
                row.get("next_stop"),
                row.get("next_stop_pos"),
                row.get("eta_seconds"),
                row.get("eta_source"),
                now,
            )


async def get_buses_for_route(route_id):
    """Return all current bus_state rows for a given route_id."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT bus_id, route_id, bus_name, lat, lon,
                   dist_along, speed, speed_source,
                   next_stop, next_stop_pos,
                   eta_seconds, eta_source, updated_at
            FROM bus_state
            WHERE route_id = $1
            ORDER BY updated_at DESC
            """,
            route_id,
        )
        return [dict(r) for r in rows]
