// Backend URL - set this after deploying to Render
// Format: https://your-app-name.onrender.com
const API_BASE = import.meta.env.VITE_API_URL || '';

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function getJson(path) {
  const url = apiUrl(path);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export function fetchRoutes() {
  return getJson('/routes');
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

  const url = apiUrl(`/routes/${routeId}/buses`);
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
