import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchRouteShape } from '../api';
import { resolveDirectionByLocation } from '../utils/routeGroups';

// Loads the shapes for the selected route group.
// Shape fetching depends ONLY on route selection — NOT on user location —
// so that geolocation watch updates never re-fetch shapes or remount the map.
export function useRouteShapes({
  selectedGroupName,
  routeGroups,
  userLocation,
  hasManualDirection,
  selectedRouteId,
  onPicked,
  fetchShape = fetchRouteShape,
}) {
  const [routeShape, setRouteShape] = useState(null);
  const [shapeLoading, setShapeLoading] = useState(false);

  const shapeMapRef = useRef(null);
  const directionResolvedRef = useRef(null);
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

  const handlePicked = useCallback(
    (id) => {
      if (onPicked) onPicked(id);
    },
    [onPicked]
  );

  const pickForGroup = useCallback(
    (group, map, { hasManualDirection, selectedRouteId, userLocation }) => {
      let pickedId = group.ids[0];
      if (hasManualDirection && group.ids.includes(selectedRouteId)) {
        pickedId = selectedRouteId;
      } else if (group.ids.length > 1 && userLocation && directionResolvedRef.current !== selectedGroupName) {
        const byLoc = resolveDirectionByLocation(group, map, userLocation);
        if (byLoc) pickedId = byLoc;
      }
      directionResolvedRef.current = selectedGroupName;
      return pickedId;
    },
    [selectedGroupName]
  );

  // Fetch shapes when the route selection changes.
  useEffect(() => {
    if (!selectedGroupName) {
      setRouteShape(null);
      shapeMapRef.current = null;
      directionResolvedRef.current = null;
      return;
    }

    const group = routeGroups.find((g) => g.displayName === selectedGroupName);
    if (!group) return;

    // If both directions are already cached (e.g. reverse button), pick from
    // cache instead of re-fetching.
    const cached = shapeMapRef.current;
    if (cached && group.ids.every((id) => cached[id])) {
      const pickedId = pickForGroup(group, cached, { hasManualDirection, selectedRouteId, userLocation: userLocationRef.current });
      setRouteShape(cached[pickedId]);
      handlePicked(pickedId);
      return;
    }

    let cancelled = false;
    // Clear the previous route's shape so stale stops/polyline don't remain
    // visible while the new route's data is loading.
    setRouteShape(null);
    setShapeLoading(true);

    Promise.all(group.ids.map((id) => fetchShape(id)))
      .then((shapes) => {
        if (cancelled) return;
        const map = Object.fromEntries(group.ids.map((id, i) => [id, shapes[i]]));
        shapeMapRef.current = map;

        const pickedId = pickForGroup(group, map, { hasManualDirection, selectedRouteId, userLocation: userLocationRef.current });
        setRouteShape(map[pickedId]);
        handlePicked(pickedId);
      })
      .catch((e) => console.error('Failed to load route shapes:', e))
      .finally(() => {
        if (!cancelled) setShapeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGroupName, routeGroups, hasManualDirection, selectedRouteId, fetchShape, handlePicked, pickForGroup]);

  // If location arrives AFTER a route was picked, resolve direction once
  // from the already-loaded shapes (no network, no map remount).
  useEffect(() => {
    if (!userLocation || !selectedGroupName || hasManualDirection) return;
    if (directionResolvedRef.current === selectedGroupName) return;

    const group = routeGroups.find((g) => g.displayName === selectedGroupName);
    const map = shapeMapRef.current;
    if (!group || !map || group.ids.length < 2) return;

    const byLoc = resolveDirectionByLocation(group, map, userLocation);
    if (!byLoc) return;
    directionResolvedRef.current = selectedGroupName;
    setRouteShape(map[byLoc]);
    handlePicked(byLoc);
  }, [userLocation, selectedGroupName, routeGroups, hasManualDirection, handlePicked]);

  return { routeShape, shapeLoading };
}