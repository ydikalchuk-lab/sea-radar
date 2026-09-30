# Checkpoint 03 — Sprint 02, after B-08…B-10

**Recorded:** 2026-09-30

**Branch:** `feat/sprint-02-aisstream-snapshot` (based on `main` at `83e668f`)

**Milestone represented:** B-08 through B-10. The final implementation continues through B-11…B-13 and is recorded in `CHECKPOINT-04.md`.

## Delivered at this milestone

- Added `.env.example` with a blank `AISSTREAM_API_KEY=` entry. Existing `.gitignore` rules already ignore `.env*` and retain `.env.example`; `git ls-files .env.local` returned no output.
- Added `getAisstreamApiKey()` in `src/lib/aisstream/key.ts`, which returns `null` for a missing or blank value and does not log the key.
- Added precise `.claude/settings.json` read-deny patterns for `.env`, `.env.local`, and `.env.*.local`. A redacted check confirmed the patterns are present and the JSON remains valid. The dummy-file permission probe was not run because the tool security guard blocked access to the `.env.local` path; effective deny behavior therefore remains unverified.
- Added the Node.js `GET /api/snapshot` Route Handler and AISStream reader. The interim B-09 route returned the first decoded frame or `raw: null` at the 15-second deadline; the route now returns the final collector contract after B-12.
- Added `data/samples/position-report.sample.json` and `data/samples/PROVENANCE.md`. The sample is synthetic and explicitly not from a live AISStream connection.

## Verification recorded

- Before Sprint 02 implementation, `npx playwright test` passed **8 tests** and `npm run build` passed.
- After B-08, `npx playwright test` passed **10 tests**.
- After B-09, the fake-socket reader tests passed **8 tests**, `npm run build` passed with `/api/snapshot` listed as a dynamic Node route, and the existing browser suite remained green.
- A local JSON/provenance check passed for the synthetic PositionReport fixture.
- The sample's `Message.PositionReport` field casing follows the AISStream documentation example. The documentation example uses uppercase `MetaData.Latitude/Longitude`, while Sprint 02 describes lowercase metadata coordinates; the converter uses the PositionReport coordinates. The documentation does not specify the `time_utc` path, so the fixture follows the Sprint 02 contract and its provenance records this distinction.

## Scope and limitations at this milestone

- No live AISStream connection was attempted and no live message was received. The AISStream key was not configured or used.
- The provider's current documentation describes a `SubscriptionConfirmation` frame even though Sprint 02 assumes no confirmation. The raw reader returns the first frame as required for B-09; the final collector ignores non-PositionReport control frames.
- The demo remains available without a key. This application is a teaching demonstration, not a navigation or monitoring system.
- This checkpoint is an uncommitted working-tree record; no commit was requested or created.
