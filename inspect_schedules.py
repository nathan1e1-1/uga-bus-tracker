#!/usr/bin/env python3
"""
Inspect routeSchedules from Passio GO getStops response
"""
import requests, json
BASE_URL = "https://passiogo.com"
UGA_SYSTEM_ID = 3994

url = f"{BASE_URL}/mapGetData.php?getStops=2"
body = {"s0": str(UGA_SYSTEM_ID), "sA": 1}
resp = requests.post(url, json=body, timeout=30)
data = resp.json()

if "routeSchedules" in data:
    rs = data["routeSchedules"]
    print(f"routeSchedules type: {type(rs)}")
    if isinstance(rs, dict):
        print(f"Keys (first 5): {list(rs.keys())[:5]}")
        for k, v in list(rs.items())[:2]:
            print(f"\nRoute {k}:")
            print(f"  Type: {type(v)}")
            if isinstance(v, dict):
                print(f"  Keys: {list(v.keys())}")
                print(f"  Sample: {json.dumps(v, indent=2)[:1000]}")
            elif isinstance(v, list):
                print(f"  Length: {len(v)}")
                print(f"  First 2 items: {v[:2]}")
    elif isinstance(rs, list):
        print(f"Length: {len(rs)}")
        print(f"First item: {rs[0]}")
else:
    print("No routeSchedules key found")
