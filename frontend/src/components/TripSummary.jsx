export function TripSummary({ trip, onClose }) {
  if (!trip) return null;

  return (
    <div className="trip-summary" role="status">
      <div className="trip-summary-header">
        <span>Your trip</span>
        {onClose && (
          <button className="trip-summary-close" onClick={onClose} aria-label="Dismiss trip">
            ×
          </button>
        )}
      </div>

      <ol className="trip-steps">
        <li>
          <span className="trip-step-text">
            Walk to <strong>{trip.originStop.name}</strong>
          </span>
          {trip.walkMin != null && <span className="trip-step-time">~{trip.walkMin} min</span>}
        </li>
        <li>
          <span className="trip-step-text">
            Take <strong>{trip.routeName}</strong> bus{trip.busName ? ` (Bus ${trip.busName})` : ''}
          </span>
          {trip.arriveMin != null && <span className="trip-step-time">arrives ~{trip.arriveMin} min</span>}
        </li>
        <li>
          <span className="trip-step-text">
            Ride to <strong>{trip.getOffStop.name}</strong>, get off at <strong>{trip.getOffStop.name}</strong>
          </span>
          {trip.rideMin != null && <span className="trip-step-time">~{trip.rideMin} min</span>}
        </li>
      </ol>
    </div>
  );
}