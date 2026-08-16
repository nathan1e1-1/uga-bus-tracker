# UGA Bus Tracker — Project Summary

## What was built
- **Data fetcher:** Python script hitting Passio GO's live bus API for UGA (system ID `3994`)
- **Backend:** FastAPI app (`api.py`) serving bus locations, routes, and ETA data
- **Frontend:** React + Vite + Leaflet web app with live map, route selector, trip planner, geolocation, nearest-stop detection, and dark mode
- **Route cache:** Committed to the repo so the Render backend works without a disk

## Live deployments
- **Frontend:** https://uga-bus-tracker-six.vercel.app
- **Backend:** https://uga-bus-api.onrender.com

## Passio GO API details
- Endpoint: `POST https://passiogo.com/mapGetData.php?getBuses=2`
- Body: `{"s0": "3994", "sA": 1}`
- UGA buses generally run **~7 AM – 8 PM EDT on weekdays**. Empty responses outside those hours are expected, not bugs.

## Last completed work
- Wrote a feature evaluation report ranking 7 proposed features:
  1. **Confidence-scored ETAs** ← top priority, smallest effort, biggest trust payoff
  2. "Should I leave now" answer-first interaction
  3. Predictive reliability flags from historical data
  4. Missed-connection recovery
  5. Crowdsourced arrival verification
  6. Push notifications
  7. UX/distribution polish
- Report saved at: `docs/superpowers/specs/2026-08-07-feature-evaluation-design.md`

## Pending / next up
1. **Add the Weekender bus route** — requested right before pausing
2. **Build Feature 1: Confidence-scored ETAs** — planned for when buses are actively running so it can be tested live

## Why the previous session broke
The conversation grew to **713 messages / ~3M input tokens**, which exceeded the model's context limit. New messages showed "thinking" briefly then failed.
