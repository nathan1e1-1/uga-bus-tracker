#!/usr/bin/env python3
"""
UGA Passio GO Bus Data Fetcher

This script hits the UGA Passio GO endpoint to pull real-time bus data
including vehicle latitude/longitude, route ID, and timestamps.

UGA System ID: 3994
API Base URL: https://passiogo.com
"""

import json
import requests
import os
from datetime import datetime, timezone

# Configuration
BASE_URL = "https://passiogo.com"
UGA_SYSTEM_ID = 3994
DATA_DIR = "bus_data"


def send_api_request(url, body):
    """Send POST request to Passio GO API and return JSON response."""
    try:
        response = requests.post(url, json=body, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
        return None


def get_vehicles(system_id=UGA_SYSTEM_ID):
    """Fetch all currently running buses for the given system."""
    url = f"{BASE_URL}/mapGetData.php?getBuses=2"
    body = {
        "s0": str(system_id),
        "sA": 1
    }
    return send_api_request(url, body)


def get_routes(system_id=UGA_SYSTEM_ID):
    """Fetch all routes for the given system."""
    url = f"{BASE_URL}/mapGetData.php?getRoutes=1"
    body = {
        "systemSelected0": str(system_id),
        "amount": 1
    }
    return send_api_request(url, body)


def parse_vehicle_data(raw_response):
    """Extract relevant fields from the raw API response."""
    vehicles = []
    
    if not raw_response or "buses" not in raw_response:
        return vehicles
    
    buses = raw_response["buses"]
    
    for vehicle_id, vehicle_data_list in buses.items():
        if vehicle_id == "-1":
            continue
        
        if not vehicle_data_list or len(vehicle_data_list) == 0:
            continue
        
        vehicle = vehicle_data_list[0]
        
        parsed = {
            "vehicle_id": vehicle.get("busId"),
            "vehicle_name": vehicle.get("busName"),
            "route_id": vehicle.get("routeId"),
            "route_name": vehicle.get("route"),
            "latitude": vehicle.get("latitude"),
            "longitude": vehicle.get("longitude"),
            "timestamp": vehicle.get("created"),
            "speed": vehicle.get("speed"),
            "pax_load": vehicle.get("paxLoad100"),
            "out_of_service": vehicle.get("outOfService"),
            "course": vehicle.get("calculatedCourse"),
            "trip_id": vehicle.get("tripId"),
        }
        vehicles.append(parsed)
    
    return vehicles


def save_data(vehicles, routes_response=None):
    """Save fetched data to a timestamped JSON file."""
    os.makedirs(DATA_DIR, exist_ok=True)
    
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(DATA_DIR, f"uga_buses_{timestamp}.json")
    
    data = {
        "fetch_timestamp": datetime.now(timezone.utc).isoformat(),
        "system_id": UGA_SYSTEM_ID,
        "vehicle_count": len(vehicles),
        "vehicles": vehicles,
    }
    
    if routes_response:
        data["routes_raw"] = routes_response
    
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)
    
    print(f"Data saved to: {filename}")
    return filename


def main():
    print("=" * 60)
    print("UGA Passio GO Bus Data Fetcher")
    print(f"Current UTC Time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)
    
    # Fetch routes first to have context
    print("\n[1/3] Fetching routes...")
    routes_response = get_routes()
    if routes_response:
        print(f"Routes response received.")
        if "all" in routes_response:
            routes = routes_response["all"]
            print(f"Found {len(routes)} routes.")
    else:
        print("WARNING: Could not fetch routes.")
        routes = []
    
    # Fetch vehicles
    print("\n[2/3] Fetching active vehicles...")
    raw_vehicles = get_vehicles()
    
    if raw_vehicles is None:
        print("ERROR: Failed to fetch vehicle data from Passio GO.")
        return 1
    
    vehicles = parse_vehicle_data(raw_vehicles)
    
    print(f"Found {len(vehicles)} active vehicle(s).")
    
    if len(vehicles) == 0:
        print("\n[!] No active buses found.")
        print("    This could mean:")
        print("    - Buses are not running at this time")
        print("    - Service hours have ended for the day")
        print("    - UGA is on break / no service")
        print("\n    Recommendation: Wait and retry during typical service hours.")
    
    # Display vehicle details
    print("\n[3/3] Vehicle Details:")
    print("-" * 60)
    
    required_fields_present = True
    for i, v in enumerate(vehicles, 1):
        print(f"\nBus #{i}: {v['vehicle_name']} (ID: {v['vehicle_id']})")
        print(f"  Route ID:     {v['route_id']}")
        print(f"  Route Name:   {v['route_name']}")
        print(f"  Latitude:     {v['latitude']}")
        print(f"  Longitude:    {v['longitude']}")
        print(f"  Timestamp:    {v['timestamp']}")
        print(f"  Speed:        {v['speed']}")
        print(f"  Pax Load:     {v['pax_load']}%")
        
        # Validate required fields
        if v['latitude'] is None or v['longitude'] is None:
            print("  [WARNING] Missing latitude/longitude!")
            required_fields_present = False
        if v['route_id'] is None:
            print("  [WARNING] Missing route_id!")
            required_fields_present = False
        if v['timestamp'] is None:
            print("  [WARNING] Missing timestamp!")
            required_fields_present = False
    
    print("\n" + "=" * 60)
    print(f"Required fields (lat/long, route_id, timestamp) present: {required_fields_present}")
    print("=" * 60)
    
    # Save data
    saved_file = save_data(vehicles, routes_response)
    
    print(f"\nDone. Data saved to: {saved_file}")
    return 0 if len(vehicles) > 0 and required_fields_present else 1


if __name__ == "__main__":
    exit(main())
