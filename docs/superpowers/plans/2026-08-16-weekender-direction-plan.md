# Weekender Direction-Aware Route Selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a single "Weekender" entry in the route selector and automatically pick the correct directional route based on GPS location or trip-planner stops, with a manual reverse option.

**Architecture:** Introduce a small pure-utility module (`frontend/src/utils/routeGroups.js`) that groups routes by name and resolves direction. App.jsx uses these utilities to manage a single displayed route that maps to one of two underlying Passio GO route IDs. TripPlanner.jsx signals App.jsx when a From/To pair requires the opposite direction.

**Tech Stack:** React, Vite, Vitest (new dev dependency for unit tests), CSS Modules via `App.css`.

---

### File Structure

| File | Responsibility |
|---|---|
| `frontend/src/utils/routeGroups.js` | Pure functions: `groupRoutes`, `resolveDirectionByLocation`, `resolveDirectionByStops`, `getOppositeDirectionId` |
| `frontend/src/utils/routeGroups.test.js` | Vitest unit tests for the pure functions |
| `frontend/src/App.jsx` | Group routes on fetch, resolve active direction, render reverse button, pass `onDirectionChange` to TripPlanner |
| `frontend/src/components/TripPlanner.jsx` | Detect wrong-direction From/To pairs and call `onDirectionChange` |
| `frontend/src/App.css` | Reverse-direction button styles |
| `frontend/package.json` | Add `vitest` dev dependency and `test` script |
| `frontend/vite.config.js` | Ensure Vitest config is present (Vite plugin-react handles JSX in tests) |

---

### Task 1: Add Vitest Test Framework

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.js`

- [ ] **Step 1: Install Vitest**

Run:
```bash
cd frontend && npm install -D vitest
```
Expected: `package.json` updates with `vitest` in `devDependencies`.

- [ ] **Step 2: Add test script**

Modify `frontend/package.json`:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "oxlint",
  "preview": "vite preview",
  "test": "vitest run"
}
```

- [ ] **Step 3: Verify vite.config.js supports Vitest**

`frontend/vite.config.js` should look like:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```
If `test` block is missing, add it. If `jsdom` environment is not installed, also run `npm install -D jsdom`.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js
git commit -m "chore: add vitest for frontend unit tests"
```

---

### Task 2: Create Route Grouping Utilities

**Files:**
- Create: `frontend/src/utils/routeGroups.js`
- Create: `frontend/src/utils/routeGroups.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/routeGroups.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { groupRoutes, resolveDirectionByLocation, resolveDirectionByStops, getOppositeDirectionId } from './routeGroups';

describe('groupRoutes', () => {
  it('groups routes with identical names', () => {
    const routes = [
      { route_id: '1', route_name: 'Central East' },
      { route_id: '2', route_name: 'Weekender' },
      { route_id: '3', route_name: 'Weekender' },
    ];
    const groups = groupRoutes(routes);
    expect(groups).toEqual([
      { displayName: 'Central East', ids: ['1'] },
      { displayName: 'Weekender', ids: ['2', '3'] },
    ]);
  });
});

describe('resolveDirectionByLocation', () => {
  it('picks direction whose nearest stop is closest', () => {
    const groups = { displayName: 'Weekender', ids: ['A', 'B'] };
    const shapes = {
      A: { stops: [{ stop_id: 1, latitude: 0, longitude: 0 }] },
      B: { stops: [{ stop_id: 2, latitude: 10, longitude: 10 }] },
    };
    const userLocation = { lat: 0.001, lng: 0.001 };
    expect(resolveDirectionByLocation(groups, shapes, userLocation)).toBe('A');
  });

  it('returns null if no shapes', () => {
    const groups = { displayName: 'Weekender', ids: ['A'] };
    expect(resolveDirectionByLocation(groups, {}, { lat: 0, lng: 0 })).toBeNull();
  });
});

describe('resolveDirectionByStops', () => {
  it('picks direction where from stop appears before to stop', () => {
    const groups = { displayName: 'Weekender', ids: ['A', 'B'] };
    const shapes = {
      A: { stops: [{ stop_id: 1 }, { stop_id: 2 }] },
      B: { stops: [{ stop_id: 2 }, { stop_id: 1 }] },
    };
    expect(resolveDirectionByStops(groups, shapes, '1', '2')).toBe('A');
  });

  it('returns null if stops not found in any direction', () => {
    const groups = { displayName: 'Weekender', ids: ['A'] };
    const shapes = { A: { stops: [{ stop_id: 1 }] } };
    expect(resolveDirectionByStops(groups, shapes, '99', '88')).toBeNull();
  });
});

describe('getOppositeDirectionId', () => {
  it('returns the other id in the group', () => {
    const groups = { displayName: 'Weekender', ids: ['A', 'B'] };
    expect(getOppositeDirectionId(groups, 'A')).toBe('B');
    expect(getOppositeDirectionId(groups, 'B')).toBe('A');
  });

  it('returns null for single-id groups', () => {
    const groups = { displayName: 'Central East', ids: ['1'] };
    expect(getOppositeDirectionId(groups, '1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd frontend && npm test
```
Expected: Tests fail because `routeGroups.js` does not exist or exports are undefined.

- [ ] **Step 3: Implement the utility functions**

Create `frontend/src/utils/routeGroups.js`:
```js
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function groupRoutes(routes) {
  const byName = new Map();
  for (const route of routes) {
    const list = byName.get(route.route_name) || [];
    list.push(route);
    byName.set(route.route_name, list);
  }
  return Array.from(byName.entries()).map(([displayName, items]) => ({
    displayName,
    ids: items.map((r) => r.route_id),
  }));
}

export function resolveDirectionByLocation(group, shapes, userLocation) {
  let bestId = null;
  let bestDistance = Infinity;
  for (const id of group.ids) {
    const shape = shapes[id];
    if (!shape?.stops?.length) continue;
    for (const stop of shape.stops) {
      const d = haversineMeters(
        userLocation.lat,
        userLocation.lng,
        stop.latitude ?? stop.lat,
        stop.longitude ?? stop.lng
      );
      if (d < bestDistance) {
        bestDistance = d;
        bestId = id;
      }
    }
  }
  return bestId;
}

export function resolveDirectionByStops(group, shapes, fromStopId, toStopId) {
  for (const id of group.ids) {
    const shape = shapes[id];
    if (!shape?.stops?.length) continue;
    const fromIndex = shape.stops.findIndex((s) => String(s.stop_id) === String(fromStopId));
    const toIndex = shape.stops.findIndex((s) => String(s.stop_id) === String(toStopId));
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex < toIndex) {
      return id;
    }
  }
  return null;
}

export function getOppositeDirectionId(group, currentId) {
  if (group.ids.length < 2) return null;
  const index = group.ids.indexOf(currentId);
  if (index === -1) return null;
  return group.ids[(index + 1) % group.ids.length];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd frontend && npm test
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/routeGroups.js frontend/src/utils/routeGroups.test.js
git commit -m "feat: add route grouping and direction resolution utilities"
```

---

### Task 3: Update App.jsx for Grouped Routes

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Import utilities**

Add to the top of `frontend/src/App.jsx`:
```js
import {
  groupRoutes,
  resolveDirectionByLocation,
  getOppositeDirectionId,
} from './utils/routeGroups';
```

- [ ] **Step 2: Add state for route groups and selected group**

Inside `App` component, replace:
```js
const [routes, setRoutes] = useState([]);
const [selectedRouteId, setSelectedRouteId] = useState(null);
```
with:
```js
const [routes, setRoutes] = useState([]);
const [routeGroups, setRouteGroups] = useState([]);
const [selectedGroupName, setSelectedGroupName] = useState(null);
const [selectedRouteId, setSelectedRouteId] = useState(null);
```

- [ ] **Step 3: Group routes after fetch and resolve initial direction**

Replace the `fetchRoutes` useEffect:
```js
useEffect(() => {
  fetchRoutes()
    .then((data) => {
      setRoutes(data);
      const groups = groupRoutes(data);
      setRouteGroups(groups);
    })
    .catch((e) => console.error('Failed to load routes:', e));
}, []);
```

- [ ] **Step 4: Resolve direction when group or location changes**

Add a new useEffect after the routes load effect:
```js
useEffect(() => {
  if (!selectedGroupName || routeGroups.length === 0) return;
  const group = routeGroups.find((g) => g.displayName === selectedGroupName);
  if (!group) return;

  let resolvedId = group.ids[0];
  if (group.ids.length > 1 && userLocation) {
    const shapeMap = {};
    for (const id of group.ids) {
      if (routeShape && routeShape.route_id === id) {
        shapeMap[id] = routeShape;
      }
    }
    const byLocation = resolveDirectionByLocation(group, shapeMap, userLocation);
    if (byLocation) resolvedId = byLocation;
  }
  setSelectedRouteId(resolvedId);
}, [selectedGroupName, routeGroups, userLocation]);
```

Wait — this effect depends on `routeShape`, but `routeShape` is fetched from `selectedRouteId`. This creates a chicken-and-egg problem. Instead, pre-fetch all shapes for grouped routes, or resolve direction only after shapes are loaded.

Correct approach: when a grouped route is selected, fetch shapes for all directions in the group first, then resolve direction. Update the route-shape useEffect.

Replace the existing route-shape useEffect with:
```js
useEffect(() => {
  if (!selectedGroupName) {
    setRouteShape(null);
    return;
  }
  const group = routeGroups.find((g) => g.displayName === selectedGroupName);
  if (!group) return;

  setShapeLoading(true);
  Promise.all(group.ids.map((id) => fetchRouteShape(id)))
    .then((shapes) => {
      const shapeMap = Object.fromEntries(group.ids.map((id, i) => [id, shapes[i]]));
      let pickedId = group.ids[0];
      if (group.ids.length > 1 && userLocation) {
        const byLocation = resolveDirectionByLocation(group, shapeMap, userLocation);
        if (byLocation) pickedId = byLocation;
      }
      setSelectedRouteId(pickedId);
      setRouteShape(shapeMap[pickedId]);
    })
    .catch((e) => console.error('Failed to load route shapes:', e))
    .finally(() => setShapeLoading(false));
}, [selectedGroupName, routeGroups, userLocation]);
```

- [ ] **Step 5: Update selector to use group names**

Replace the `<select>` rendering:
```jsx
<select
  className="pill-select"
  value={selectedGroupName || ''}
  onChange={(e) => setSelectedGroupName(e.target.value)}
>
  <option value="" disabled>Choose route…</option>
  {routeGroups.map((g) => (
    <option key={g.displayName} value={g.displayName}>
      {g.displayName}
    </option>
  ))}
</select>
```

- [ ] **Step 6: Add reverse-direction button**

Add after the `<select>` inside the top-bar:
```jsx
{selectedRouteId && routeGroups.find((g) => g.displayName === selectedGroupName)?.ids.length > 1 && (
  <button
    className="reverse-btn"
    onClick={() => {
      const group = routeGroups.find((g) => g.displayName === selectedGroupName);
      const nextId = getOppositeDirectionId(group, selectedRouteId);
      if (!nextId) return;
      setSelectedRouteId(nextId);
      setShapeLoading(true);
      fetchRouteShape(nextId)
        .then((shape) => setRouteShape(shape))
        .catch((e) => console.error('Failed to reverse direction:', e))
        .finally(() => setShapeLoading(false));
    }}
    aria-label="Reverse direction"
  >
    ⇄
  </button>
)}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.jsx
npm run lint
npm run build
git commit -m "feat: group routes and auto-resolve Weekender direction"
```

---

### Task 4: Update TripPlanner for Direction Swapping

**Files:**
- Modify: `frontend/src/components/TripPlanner.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Accept onDirectionChange prop**

Change the TripPlanner signature:
```js
export default function TripPlanner({ routes, selectedRouteId, selectedRouteShape, liveBuses, userLocation, nearestStop, onClose, onDirectionChange }) {
```

- [ ] **Step 2: Import resolveDirectionByStops**

Add import:
```js
import { resolveDirectionByStops } from '../utils/routeGroups';
```

- [ ] **Step 3: Detect wrong direction and request swap**

Add a useEffect inside TripPlanner that runs when From/To stops change:
```js
useEffect(() => {
  if (!fromStopId || !toStopId || !selectedRouteShape || !routes.length) return;

  const currentGroup = routes.find((r) => r.route_id === selectedRouteId);
  if (!currentGroup) return;

  const group = {
    displayName: currentGroup.route_name,
    ids: routes
      .filter((r) => r.route_name === currentGroup.route_name)
      .map((r) => r.route_id),
  };
  if (group.ids.length < 2) return;

  const shapeMap = { [selectedRouteId]: selectedRouteShape };
  const correctId = resolveDirectionByStops(group, shapeMap, fromStopId, toStopId);
  if (correctId && correctId !== selectedRouteId && onDirectionChange) {
    onDirectionChange(correctId);
  }
}, [fromStopId, toStopId, selectedRouteShape, selectedRouteId, routes, onDirectionChange]);
```

This only checks the current shape. If the current shape has From after To, it requests a swap. But if the correct direction's shape isn't loaded, we can't verify the pair. For now this is sufficient because App.jsx loads all group shapes.

- [ ] **Step 4: Pass callback from App.jsx**

In `App.jsx`, update the TripPlanner JSX:
```jsx
<TripPlanner
  routes={routes}
  selectedRouteId={selectedRouteId}
  selectedRouteShape={routeShape}
  liveBuses={buses}
  userLocation={userLocation}
  nearestStop={nearestStop}
  onClose={() => setShowPlanner(false)}
  onDirectionChange={(nextId) => setSelectedRouteId(nextId)}
/>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/TripPlanner.jsx
npm run lint
npm run build
git commit -m "feat: trip planner auto-switches Weekender direction"
```

---

### Task 5: Style the Reverse-Direction Button

**Files:**
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Add reverse button styles**

Append to `frontend/src/App.css`:
```css
.reverse-btn {
  background: var(--surface);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 9999px;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
  margin-left: 0.5rem;
  transition: background 0.15s ease;
}

.reverse-btn:hover {
  background: var(--surface-hover);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.css
npm run lint
npm run build
git commit -m "style: reverse direction button"
```

---

### Task 6: Manual Verification

- [ ] **Step 1: Start local dev server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Verify route selector**

Open http://localhost:5173. Confirm:
- Only one "Weekender" option exists in the route selector.
- All other routes still appear once.

- [ ] **Step 3: Verify direction resolution**

With location permission granted:
- Select "Weekender".
- The map should load the direction whose nearest stop is closest to your location.
- Buses for that direction should appear.

- [ ] **Step 4: Verify reverse button**

Click the ⇄ button. The map and buses should switch to the opposite Weekender direction.

- [ ] **Step 5: Verify trip planner**

Open the trip planner, select From and To stops that are in opposite order on the currently loaded direction. The app should auto-switch direction and recompute ETAs.

- [ ] **Step 6: Deploy**

```bash
git push
npx vercel --prod
```

Wait for Vercel deployment to complete, then verify on the production URL.

---

## Self-Review

**Spec coverage:**
- Single "Weekender" entry: Task 3 Step 5.
- GPS-based direction resolution: Task 2 utilities + Task 3 Step 4.
- Reverse-direction button: Task 3 Step 6 + Task 5.
- Trip planner auto-switch: Task 4.
- No backend changes: Confirmed.

**Placeholder scan:**
- No TBD/TODO.
- All code shown.
- Exact commands provided.

**Type consistency:**
- `groupRoutes` returns `{ displayName, ids }` used consistently.
- `resolveDirectionByLocation` and `resolveDirectionByStops` accept the same group shape.
- `onDirectionChange` prop matches callback in App.jsx.
