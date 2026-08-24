// Route selector + reverse button, grouped in one container so the flex
// top-bar keeps them together on the right (not spread out by space-between).
export default function RouteSelector({
  routeGroups,
  selectedGroupName,
  selectedRouteId,
  routesLoading,
  routesError,
  onSelect,
  onReverse,
}) {
  const group = selectedGroupName
    ? routeGroups.find((g) => g.displayName === selectedGroupName)
    : null;
  const showReverse = !!selectedRouteId && group?.ids.length > 1;

  return (
    <div className="top-bar-controls">
      {routesLoading ? (
        <span className="pill-select" style={{ opacity: 0.6 }}>Loading routes…</span>
      ) : routesError ? (
        <span className="pill-select" style={{ color: '#EF4444' }}>Routes unavailable</span>
      ) : (
        <select
          className="pill-select"
          value={selectedGroupName || ''}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="" disabled>Choose route…</option>
          {routeGroups.map((g) => (
            <option key={g.displayName} value={g.displayName}>
              {g.displayName}
            </option>
          ))}
        </select>
      )}
      {showReverse && (
        <button
          className="reverse-btn"
          onClick={() => onReverse && onReverse(group)}
          aria-label="Reverse direction"
        >
          ⇄
        </button>
      )}
    </div>
  );
}