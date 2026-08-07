#!/usr/bin/env python3
"""
Passio GO API Explorer - Finding Route Shapes
"""

import requests
import json

BASE_URL = "https://passiogo.com"
UGA_SYSTEM_ID = 3994

def try_endpoint(url, body=None, name=""):
    print(f"\n{'='*60}")
    print(f"TRYING: {name}")
    print(f"URL: {url}")
    print(f"BODY: {body}")
    try:
        resp = requests.post(url, json=body, timeout=30)
        print(f"Status: {resp.status_code}")
        try:
            data = resp.json()
            print(f"Response keys: {list(data.keys()) if isinstance(data, dict) else type(data)}")
            print(json.dumps(data, indent=2)[:2000])  # First 2000 chars
            return data
        except:
            print(f"Raw (first 500 chars): {resp.text[:500]}")
            return None
    except Exception as e:
        print(f"Error: {e}")
        return None

# 1. Get routes with full detail
routes = try_endpoint(
    f"{BASE_URL}/mapGetData.php?getRoutes=1",
    {"systemSelected0": str(UGA_SYSTEM_ID), "amount": 1},
    "getRoutes"
)

# 2. Get stops 
stops = try_endpoint(
    f"{BASE_URL}/mapGetData.php?getStops=2",
    {"s0": str(UGA_SYSTEM_ID), "sA": 1},
    "getStops"
)

# 3. Try route map data / shapes
# Common patterns in transit APIs:
try_endpoint(
    f"{BASE_URL}/mapGetData.php?getRouteShape=1",
    {"systemSelected0": str(UGA_SYSTEM_ID), "routeId": "64018"},
    "getRouteShape (guessed)"
)

try_endpoint(
    f"{BASE_URL}/mapGetData.php?getRoutePaths=1",
    {"systemSelected0": str(UGA_SYSTEM_ID), "routeId": "64018"},
    "getRoutePaths (guessed)"
)

try_endpoint(
    f"{BASE_URL}/mapGetData.php?getRouteMap=1",
    {"systemSelected0": str(UGA_SYSTEM_ID), "routeId": "64018"},
    "getRouteMap (guessed)"
)

# 4. Try goServices endpoints
try_endpoint(
    f"{BASE_URL}/goServices.php?getRouteDetails=1",
    {"systemSelected0": str(UGA_SYSTEM_ID), "routeId": "64018"},
    "goServices getRouteDetails"
)

# 5. Try vehicles endpoint with more detail
vehicles = try_endpoint(
    f"{BASE_URL}/mapGetData.php?getBuses=2",
    {"s0": str(UGA_SYSTEM_ID), "sA": 1},
    "getBuses"
)

print("\n" + "="*60)
print("EXPLORATION COMPLETE")
print("="*60)
