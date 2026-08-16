# Weekender Direction-Aware Route Selection

## Problem
Passio GO represents the Weekender route as two separate route IDs (one per direction):
- `74535`: University Village Circle → Health Sciences Campus (21 stops)
- `74536`: Health Sciences Campus → University Village Circle (19 stops)

Both have the same `route_name` (`"Weekender"`), so the frontend dropdown currently shows two identical "Weekender" entries. This is confusing and clutters the route selector.

## Goal
Show a single "Weekender" entry in the route selector and automatically load the direction that makes sense for the user's context. Let the user manually reverse the direction if needed.

## Design

### 1. Route Grouping
After fetching `/routes`, the frontend groups routes with identical `route_name`. For now this only affects Weekender, but the grouping is generic and will apply to any future route pair with the same name.

```js
// Example grouped structure
const routeGroups = [
  { displayName: "Central East", ids: ["44886"] },
  { displayName: "Weekender", ids: ["74535", "74536"] },
  // ...
];
```

### 2. Selector Behavior
- The route `<select>` renders one `<option>` per group.
- Selecting "Weekender" resolves to a concrete underlying route ID before fetching shape or buses.

### 3. Direction Resolution
When a grouped route is selected, pick the underlying direction using this priority:
1. **GPS-based:** If `userLocation` is available, compute the nearest stop on each direction and pick the direction with the closest stop.
2. **Trip-planner-based:** If the trip planner has From/To stops selected, pick the direction where From appears before To in the stop list.
3. **Fallback:** Default to the first direction in the group (`74535`).

The resolved direction is stored as the active `selectedRouteId` used by `fetchRouteShape` and bus polling.

### 4. Manual Override
When a grouped route is active, show a "Reverse direction" button in the top bar. Tapping it swaps to the other direction in the group and re-fetches shape + buses.

### 5. Trip Planner Integration
- When the user picks From and To stops, check the current direction's stop list.
- If the From stop appears after the To stop, the selected direction is wrong.
- Auto-switch to the other direction in the group and recompute recommendations.
- If stops exist in only one direction, switch to that direction.

### 6. Display
- Route selector continues to show "Weekender".
- Optional: show a small subtitle under the route name on the map/card indicating the direction, e.g., "Weekender → Health Sciences Campus".

## Files to Change
- `frontend/src/App.jsx`
  - Group routes after fetch.
  - Resolve direction on selection and GPS change.
  - Add reverse-direction button.
  - Pass an `onDirectionChange` callback to `TripPlanner` so the planner can request a direction swap.
- `frontend/src/components/TripPlanner.jsx`
  - Detect wrong-direction From/To pairs and call `onDirectionChange` to swap direction.
- `frontend/src/App.css`
  - Style for the reverse-direction button.

## No Backend Changes
The backend already exposes both route IDs via `/routes` and `/routes/{id}/shape`. Only the frontend grouping logic changes.

## Success Criteria
- [ ] Route selector shows exactly one "Weekender" option.
- [ ] Selecting "Weekender" loads a real direction and shows buses on the map.
- [ ] Reverse-direction button swaps to the other Weekender direction.
- [ ] Trip planner auto-switches direction when From/To stops are in the opposite order.
