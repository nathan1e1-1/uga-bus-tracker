// API base URL: use Vite proxy (/api → backend) in dev, absolute URL in prod
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'http://localhost:8000')
  : '/api';

export async function fetchRoutes() {
  const res = await fetch(`${API_BASE}/routes`);
  if (!res.ok) throw new Error('Failed to fetch routes');
  return res.json();
}

export async function fetchRouteShape(routeId) {
  const res = await fetch(`${API_BASE}/routes/${routeId}/shape`);
  if (!res.ok) throw new Error('Failed to fetch route shape');
  return res.json();
}

export async function fetchBuses(routeId) {
  const res = await fetch(`${API_BASE}/routes/${routeId}/buses`);
  if (!res.ok) throw new Error('Failed to fetch buses');
  return res.json();
}
