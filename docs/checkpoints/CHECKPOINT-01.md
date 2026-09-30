# Checkpoint 01 — Sprint 01, after B-04

**Recorded:** 2026-09-30 (personal replay copy)

**Historical snapshot:** commit `433883c` (`feat: add selectable vessel details`) on `feat/sprint-01`

**Next implementation step at that snapshot:** B-05 — three literal demo routes

## Delivered at the B-04 snapshot

- Client-only Leaflet map of the Dover Strait, using OpenStreetMap Standard tiles with visible attribution and the configured regional bounds.
- One static demonstration vessel, `demo-1`, with a course-oriented marker and the “Демонстраційні дані” source label.
- Selecting the vessel opens a card with ID, name, coordinates, speed, course, UTC message time, and source, formatted per Sprint 01.
- The selected card remains open after repeated marker clicks and map-background clicks; it has no close button.

## How to run at this snapshot

- `npm run dev` — serves the local application at `http://127.0.0.1:3000`.
- `npx playwright test --reporter=line` — browser test suite.
- `npm run build` — production build.

## Verification recorded for B-01 through B-04

- Map checks: direct open and refresh, pan/zoom, visible OSM attribution, and viewport resize were manually observed without gray, duplicate, or displaced map artifacts.
- Vessel/card checks: one marker was visible and oriented by course; selecting it showed the matching card. Repeated marker click and map-background click left the card open.
- Formatting edge checks: `<b>Демо</b>` displayed literally as text; empty name normalized to no data; null speed/course displayed “Немає даних” with neutral marker; `0` displayed as `0 kn`; a course rounding to 360 displayed as `0°`. The static fixture was restored before B-04 review.
- Playwright passed **3 tests** after B-04 implementation, including the selected-card persistence test.
- `npm run build` passed after B-04; Next.js prerendered `/` and `/_not-found` as static routes.

## Scope and limitations at this snapshot

- This checkpoint represented **one static demonstration vessel**, not the later three-route milestone.
- AISStream was not integrated; no real-data checks were performed, and no AISStream key was read, added, or used.
- This is a teaching demonstration, not a navigation or monitoring system.
- Movement, additional vessels, and any real-data integration were not part of this B-04 snapshot.

## Checkpoint note

The project guidance references `docs/checkpoints/TEMPLATE.md`, but no such template was present in the repository. This historical checkpoint follows the Sprint 01 checkpoint requirements. No archive was created; this is a personal replay copy.
