// Backend URL - set this after deploying to Render
// Format: https://your-app-name.onrender.com
const API_BASE = import.meta.env.VITE_API_URL || '';

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function getJson(path) {
  const url = apiUrl(path);
  console.log(`[API] GET ${url}`);
  try {
    const res = await fetch(url);
    console.log(`[API] Response ${res.status} for ${path}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (e) {
    console.error(`[API] Fetch failed for ${path}:`, e.message);
    throw e;
  }
}

export function fetchRoutes() {
  return getJson('/routes');
}

export function fetchAllStops() {
  return getJson('/stops');
}

export function fetchRouteShape(routeId) {
  return getJson(`/routes/${routeId}/shape`);
}

export function fetchBuses(routeId) {
  if (!API_BASE) {
    console.warn('No backend URL configured. Buses will not show.');
    console.warn('Deploy backend to Render and set VITE_API_URL');
    return Promise.resolve([]);
  }

  const path = routeId ? `/routes/${routeId}/buses` : '/buses';
  const url = apiUrl(path);
  console.log('[fetchBuses] Requesting:', url);

  return fetch(url)
    .then((res) => {
      console.log('[fetchBuses] Response status:', res.status);
      if (!res.ok) {
        console.error('[fetchBuses] HTTP error:', res.status, res.statusText);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    })
    .then((data) => {
      console.log('[fetchBuses] Received', data.length, 'buses');
      return data;
    })
    .catch((e) => {
      console.error('[fetchBuses] Fetch failed:', e.message);
      return [];
    });
}

export function fetchAllBuses() {
  return fetchBuses(null);
}
