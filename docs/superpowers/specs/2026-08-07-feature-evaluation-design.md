# UGA Bus Tracker — Feature Evaluation Report

**Date:** 2026-08-07
**Context:** UGA Bus Tracker PWA — real-time campus bus tracking with Passio GO data
**Purpose:** Evaluate 7 proposed features for student value, feasibility, and competitive positioning

---

## Current Product State

- **Frontend:** React + Vite PWA deployed on Vercel
- **Backend:** FastAPI on Render (in-memory polling, 30s interval)
- **Data source:** Passio GO API (UGA system 3994)
- **Core capability:** Route shapes, stop positions, live bus GPS, speed/ETA computation
- **Unique moat:** Historical Postgres data (bus positions, speed patterns, on-time performance)

---

## Feature 1: Confidence-Scored ETAs

**Proposal:** Surface ETA source tier — "4 min (live)" vs "~6 min (estimated)" vs "8 min (scheduled, no live data)"

**Current implementation:** Already tiered in backend (live → estimated → scheduled → default), but not exposed in UI

**Student value:** ⭐⭐⭐⭐⭐ (Critical)
- **Why:** Passio GO and UGA app both show confident single-number ETAs even when buses haven't moved in 90 seconds
- **Trust payoff:** Students learn within a week which apps lie. Showing "estimated" when speed is inferred vs "live" when GPS is fresh builds trust through transparency
- **Behavior change:** Students can weight decisions based on certainty — "estimated 6 min" means "leave in 4 min to be safe"

**Implementation:**
- **Effort:** Low (backend already has `eta_source` field, frontend needs formatting)
- **UI change:** Add `(live)` / `(estimated)` / `(scheduled)` badge next to ETA in bus popups and trip planner cards
- **Color coding:** Green for live, amber for estimated, gray for scheduled — makes quality obvious at a glance
- **Risk:** None. Pure additive UI.

**Competitive advantage:** Medium. Easy for Passio to copy if they notice, but they probably won't since they're not product-focused.

**Verdict:** Build immediately. 2-4 hours of work.

---

## Feature 2: "Should I Leave Now" Primary Interaction

**Proposal:** Reframe from map-first to answer-first — input building → get walk time + wait time + total ETA with countdown

**Student value:** ⭐⭐⭐⭐⭐ (Critical)
- **Why:** The actual question students have is never "where is the bus" — it's "will I make my class" or "when do I need to leave"
- **Frequency:** This use case happens 10x more often than "curious where buses are"
- **Addressable market:** Every student with a timed commitment (class, meeting, dining hall closing)

**Implementation:**
- **Effort:** Medium (requires building a destination selector, walk-time calculator, countdown UI)
- **New components needed:**
  - Building/location selector (UGA has ~200 buildings, need searchable list)
  - Walking time calculator (distance from current/selected location to nearest stop)
  - Trip assembly: walk time → wait time → ride time → arrival time
  - Countdown timer that accounts for walking
- **Data needs:** Building coordinates database, walking speed assumptions (UGA pedestrian network)
- **UX risk:** If the answer is wrong even once (e.g., missed connection), trust evaporates. Needs rock-solid fallback behavior.

**Competitive advantage:** High. Passio GO is map-first by design. UGA app is also map-first. This is a category shift.

**Verdict:** Build as the primary tab/screen, but keep map accessible. This is the core differentiator. 2-3 days of focused work.

---

## Feature 3: Predictive Unreliability Flags

**Proposal:** Use historical Postgres data to flag "this route is statistically 5+ min late every day at this time"

**Student value:** ⭐⭐⭐⭐ (High)
- **Why:** Humans are bad at remembering patterns across days. "Oh yeah, the North South is always late at 2pm" is tribal knowledge that freshmen don't have
- **Behavior change:** Students can plan buffer time based on actual route reliability, not just today's snapshot

**Implementation:**
- **Effort:** Medium-High (requires analytics pipeline on existing data)
- **Data requirements:**
  - Aggregate historical on-time performance by route + time-of-day + day-of-week
  - Define "late": bus arrived at stop >5 min after scheduled/ETA prediction
  - Storage: materialized view or computed metric, updated daily
- **Backend work:**
  - Daily cron to compute route reliability scores
  - API endpoint: `/routes/{id}/reliability` returning `{on_time_pct: 72, avg_delay_min: 3.2, sample_size: 142}`
- **UI work:** Badge on route selector ("82% on time") or warning in trip planner
- **Moat strength:** High. Passio GO doesn't retain history. This is defensible.

**Verdict:** Build after confidence-scored ETAs. This is the data moat feature that justifies the backend infrastructure. 3-4 days.

---

## Feature 4: Missed-Connection Recovery

**Proposal:** If a tracked bus passes the user's stop or gets rerouted, proactively suggest next best option

**Student value:** ⭐⭐⭐⭐ (High)
- **Why:** The worst bus app experience is watching your bus roll past while the app still shows "2 min away"
- **Emotional impact:** Turning failure into "the app has my back" creates loyalty
- **Frequency:** Not daily, but high-impact when it happens

**Implementation:**
- **Effort:** Medium-High (requires geofencing + alternative route logic)
- **Detection logic:**
  - User is waiting at stop X for route A
  - Bus on route A passes stop X without stopping (or is marked "out of service")
  - Trigger: "Bus passed your stop — next options:"
- **Recovery suggestions:**
  - Next bus on same route (with ETA)
  - Alternative route that serves nearby stops (e.g., Milledge instead of North South)
  - Walking route to destination if faster than waiting
- **Notification mechanism:** In-app banner (not push — too noisy for this)
- **Edge cases:** How do we know user is "waiting" vs just browsing? Need intent signal (e.g., selected stop in trip planner)

**Verdict:** Build after "Should I Leave Now" is solid. Requires knowing user intent, which that feature provides. 2-3 days.

---

## Feature 5: Crowdsourced Light-Touch Verification

**Proposal:** One-tap "bus just arrived" / "bus never came" button at stops to validate ETA model

**Student value:** ⭐⭐⭐ (Moderate)
- **Why:** Students like feeling their input matters; also catches Passio feed outages faster than official channels
- **Network effect:** More valuable as user base grows (low utility with <50 users)

**Implementation:**
- **Effort:** Low-Medium (simple button + data collection)
- **Components:**
  - Tap-to-report button on stop popup (only when bus is expected within ±5 min)
  - Store: `{stop_id, route_id, expected_bus_id, report_type: 'arrived'|'missing', timestamp, user_id_hash}`
- **Privacy:** Hash user ID, don't store location history
- **Backend work:**
  - New table/collection for verification events
  - Simple aggregation: if 3+ users report "missing" within 10 min window, flag potential outage
- **Cold start problem:** Useless until ~50 active users. Needs to launch after core features have traction.

**Moat value:** Medium. The data is useful, but the primary moat is the historical analytics (Feature 3), not real-time crowdsourcing.

**Verdict:** Defer until after core features are live and user base reaches 50+ daily active. 1-2 days when built.

---

## Feature 6: Push Notifications

**Proposal:** Proactive "your bus is 5 min out" based on saved route+stop, optionally cross-referenced with class schedule

**Student value:** ⭐⭐⭐⭐ (High)
- **Why:** Pull apps require active checking. Push reduces cognitive load — student doesn't need to remember to open the app
- **Smart scheduling:** Cross-referencing with class schedule means no notification on days you're not going that way
- **Competitive context:** Passio GO and UGA app are both pull-only

**Implementation:**
- **Effort:** Medium-High (PWA push notifications are complex)
- **Technical requirements:**
  - Service Worker push event handling (already have SW via vite-plugin-pwa)
  - Web Push API subscription management
  - VAPID keys for secure push
  - Backend: schedule notification when bus is ~5 min from saved stop
  - User preferences: saved routes/stops, quiet hours, class schedule integration
- **Permission friction:** Browser push permission prompts are annoying. Need to earn trust before asking.
- **Delivery reliability:** PWA push is less reliable than native. Some students will miss notifications.

**Verdict:** Build after core features are stable. Push without reliable ETAs is worse than no push. 3-4 days.

---

## Feature 7: UX & Distribution Strategy

**Proposal:** Make the app look intentionally better during failure states, lead onboarding with the answer, use on-time % badges, drive word-of-mouth in group chats

**Student value:** ⭐⭐⭐⭐ (High — indirectly)
- **Why:** Students adopt apps their friends use. Distribution through dorm/club group chats is the realistic path for a campus-scoped product
- **Positioning:** First screen answers "will I make it" → immediate differentiation from Passio clone

**Implementation:**
- **Effort:** Low-Medium (mostly UI/UX polish)
- **Specific items:**
  - **On-time % badge:** Add to route selector (requires Feature 3 backend)
  - **Empty states:** "Buses offline — Service resumes at 7:00 AM" instead of blank map
  - **Landing screen:** "Leave Now" calculator as primary view
  - **Confidence badges:** Color-coded ETA sources (requires Feature 1)

**Verdict:** Build incrementally as other features land. These are polish items that amplify the core value. 1-2 days total, spread across releases.

---

## Priority Matrix

| Feature | Student Value | Implementation Effort | Competitive Moat | Priority |
|---------|---------------|----------------------|-------------------|----------|
| 1. Confidence-scored ETAs | Critical | Low (2-4 hrs) | Medium | **Build first** |
| 2. "Should I Leave Now" | Critical | Medium (2-3 days) | High | **Build second** |
| 3. Predictive reliability flags | High | Medium-High (3-4 days) | Very High | **Build third** |
| 4. Missed-connection recovery | High | Medium-High (2-3 days) | Medium | Build after #2 |
| 6. Push notifications | High | Medium-High (3-4 days) | Medium | Build after core stable |
| 5. Crowdsourced verification | Moderate | Low-Medium (1-2 days) | Low | Defer to 50+ DAU |
| 7. UX/distribution polish | High (indirect) | Low-Medium (1-2 days) | N/A | Continuous |

---

## Recommended Roadmap

### Phase 1: Trust (Week 1)
- Feature 1: Confidence-scored ETAs
- Feature 7: Empty state messaging ("Buses offline")
- Goal: Make the app honest. Students notice immediately.

### Phase 2: Differentiation (Week 2-3)
- Feature 2: "Should I Leave Now" primary interaction
- Feature 7: Landing screen redesign around answer-first model
- Goal: Stop looking like a Passio clone.

### Phase 3: Moat (Week 4-5)
- Feature 3: Predictive reliability flags
- Feature 7: On-time % badges on route selector
- Goal: Build defensible data advantage.

### Phase 4: Delight (Week 6-8)
- Feature 4: Missed-connection recovery
- Feature 6: Push notifications
- Goal: Proactive experience that Passio can't match.

### Phase 5: Scale (When ready)
- Feature 5: Crowdsourced verification
- Goal: Network effects and ground-truth validation.

---

## Anti-Features (What Not to Build)

- **Real-time chat / social features:** Out of scope. Students have GroupMe/iMessage.
- **Gamification / points for reports:** Complicates Feature 5. Keep it frictionless.
- **Route planning across multiple buses:** UGA campus is small enough that single-route answers cover 90% of trips. Multi-route adds complexity without proportional value.
- **Driver-facing features:** Passio GO owns the driver relationship. Don't try to compete there.

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Passio GO changes API/blockers | Medium | Abstract Passio client, keep route cache as backup |
| Render free tier sleeps (30s cold start) | High | Use uptime monitor or upgrade to paid ($7/mo) |
| Student adoption is slow | Medium | Start with one dorm group chat, measure organic growth |
| Historical data isn't rich enough for Feature 3 | Low | Need ~2 weeks of polling for meaningful patterns |
| iOS Safari PWA limitations | Medium | Test push notifications specifically on Safari |

---

## Conclusion

**All 7 features are worth building, but in sequence.** The first two (confidence-scored ETAs + answer-first interaction) provide 80% of the competitive differentiation with <20% of the total effort. Features 3-6 build the moat and proactive experience. Feature 5 (crowdsourcing) is the only one that should wait for user base scale.

**Immediate next step:** Build Feature 1 (confidence-scored ETAs) — it's 2-4 hours of work and immediately makes the app more trustworthy than any alternative on campus.
