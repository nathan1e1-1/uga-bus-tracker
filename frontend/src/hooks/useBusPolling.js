import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchBuses } from '../api';

const POLL_INTERVAL_MS = 15_000; // 15s — backend refreshes every 30s anyway

export function useBusPolling(routeId) {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const poll = useCallback(async () => {
    if (!routeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBuses(routeId);
      setBuses(data);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    if (!routeId) return;
    poll(); // initial fetch
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [routeId, poll]);

  return { buses, loading, error, lastUpdated, refetch: poll };
}
