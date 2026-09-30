# Checkpoint 02 — Sprint 01

**Date:** 2026-09-30  
**Branch:** `feat/sprint-01`  
**Starting point for the next session:** commit `533aff1` (`test: cover demo vessel selection`)

## Delivered

- A client-rendered Leaflet map of the Dover Strait with OpenStreetMap Standard tiles and visible attribution.
- Three literal demo routes (`demo-1` through `demo-3`), each with 8–12 points inside the configured region, the required Ukrainian names, and a literal speed.
- All three vessels start at their first route point. A single parent-owned 2-second interval advances the same vessel state consumed by the map and selected-vessel card. Courses are calculated from the current route segment; each vessel stops on its final point with speed `0 kn` and retains its arrival time and final course on later ticks.
- A selectable vessel card with formatted coordinates, speed, course, UTC message time, and demo source label.
- Playwright browser tests for three visible markers and selection persistence. OSM tile requests are aborted before page navigation in the tests.

## How to run

- Start locally: `npm run dev` (bound to `127.0.0.1:3000`).
- Browser tests: `npx playwright test`.
- Production build: `npm run build`.

## Verification performed

- `npx playwright test` — passed, **5 tests** (`5 passed (2.8s)` on the final checkpoint run).
- `npm run build` — passed; production build compiled, TypeScript completed, and `/` plus `/_not-found` were prerendered as static routes.
- Visual browser check on `http://127.0.0.1:3000/`: three markers and “Демонстраційні дані” were visible. Selecting `demo-1` showed its card and the card followed its movement from `51.00000, 1.30000` to `51.01000, 1.34000` over a 2.2-second interval; its marker position changed.
- Visual arrival/stop check: after a fresh page load, `demo-1` was at its tenth/final point (`51.10000, 1.65000`) after approximately 18.8 seconds. At that point and again 12 seconds later, it remained at that position with `0 kn`, unchanged course, and unchanged arrival timestamp (`07:44:54 UTC`).
- During hot reload diagnostic verification, tick observations advanced at approximately 2-second intervals; temporary diagnostics were removed before commit. No controlled-time movement tests were added.
- Reviewed the B-07 test/config/dependency state: one Chromium Playwright project, loopback-only dev server, tile route abort registered before navigation, and no additional test runner dependency. `git diff --check` passed; production build left no `next-env.d.ts` change.

## Scope and limitations

- The app contains **three static demo route definitions**, not real vessel tracking. AISStream is not integrated, no real-data checks were performed, and no AISStream key was read, added, or used.
- The browser tests cover map visibility, marker count/course semantics, and selection/card persistence; they do not automate movement timing or route arrival.
- No pause, rewind, looping, route-trail UI, API/server scaffolding, or future-sprint placeholders were added.
- This is a teaching demonstration, not a navigation or monitoring system.

## Checkpoint note

The project guidance references `docs/checkpoints/TEMPLATE.md`, but that template was not present in the repository at checkpoint creation; this record follows the checkpoint requirements in the current Sprint 01 brief instead. No archive was created; this is a personal replay copy.
