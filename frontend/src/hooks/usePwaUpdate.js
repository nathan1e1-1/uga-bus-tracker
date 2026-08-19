import { useState, useEffect, useRef, useCallback } from 'react';
import { registerSW } from 'virtual:pwa-register';

// Surfaces PWA service-worker updates so the UI can prompt the user to reload
// and pick up new builds (prevents users getting stuck on stale caches).
export function usePwaUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const updateSWRef = useRef(null);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
    });
    updateSWRef.current = updateSW;
    return () => {
      if (updateSW) updateSW();
    };
  }, []);

  const reload = useCallback(() => {
    if (updateSWRef.current) updateSWRef.current(true);
  }, []);

  return { needRefresh, offlineReady, reload };
}