#!/usr/bin/env python3
"""
Deep dive into routePoints and other shape data from getStops response
"""

import requests
import json

BASE_URL = "https://passiogo.com"
UGA_SYSTEM_ID = 3994

url = f"{BASE_URL}/mapGetData.php?getStops=2"
body = {"s0": str(UGA_SYSTEM_ID), "sA": 1}

resp = requests.post(url, json=body, timeout=30)
data = resp.json()

print("Top-level keys:", list(data.keys()))
print()

# Check routePoints
if "routePoints" in data:
    rp = data["routePoints"]
    print(f"routePoints type: {type(rp)}")
    if isinstance(rp, dict):
        print(f"routePoints keys (first 10): {list(rp.keys())[:10]}")
        for k, v in list(rp.items())[:2]:
            print(f"\nRoute {k}:")
            print(f"  Type: {type(v)}")
            if isinstance(v, list):
                print(f"  Length: {len(v)}")
                print(f"  First 3 points: {v[:3]}")
            elif isinstance(v, dict):
                print(f"  Keys: {list(v.keys())}")
                print(f"  Sample: {json.dumps(v, indent=2)[:500]}")
            else:
                print(f"  Value: {v[:200] if isinstance(v, str) else v}")
    elif isinstance(rp, list):
        print(f"Length: {len(rp)}")
        print(f"First item: {rp[0] if rp else 'empty'}")

print("\n" + "="*60)

# Check groupRoutes
if "groupRoutes" in data:
    gr = data["groupRoutes"]
    print(f"groupRoutes type: {type(gr)}")
    if isinstance(gr, dict):
        print(f"Keys (first 5): {list(gr.keys())[:5]}")
        for k, v in list(gr.items())[:1]:
            print(f"\nGroup {k}: {v}")

print("\n" + "="*60)

# Check routes structure
if "routes" in data:
    routes = data["routes"]
    print(f"routes type: {type(routes)}")
    if isinstance(routes, dict):
        print(f"Keys (first 5): {list(routes.keys())[:5]}")
        for k, v in list(routes.items())[:1]:
            print(f"\nRoute {k}:")
            print(f"  Type: {type(v)}")
            print(f"  Length if list: {len(v)}")
            print(f"  Content: {v[:5]}")

print("\n" + "="*60)

# Check stopsRR
if "stopsRR" in data:
    sr = data["stopsRR"]
    print(f"stopsRR type: {type(sr)}")
    print(f"Keys if dict: {list(sr.keys())[:5] if isinstance(sr, dict) else 'N/A'}")
