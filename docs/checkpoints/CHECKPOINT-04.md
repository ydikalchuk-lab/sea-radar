# Checkpoint 04 — Sprint 02 R2 complete

**Recorded:** 2026-09-30

**Branch:** `feat/sprint-02-aisstream-snapshot` (based on `main` at `83e668f`)

**Starting point:** Sprint 01 R1 completion in `docs/checkpoints/CHECKPOINT-02.md` (three moving demo routes, selectable cards, and Playwright coverage).

## Delivered

- Added safe key access and the blank `.env.example`; `.gitignore` already excludes local `.env*` files while retaining the example. Added narrowly scoped read-deny patterns in `.claude/settings.json`.
- Added `GET /api/snapshot` on the Node.js runtime. The server-side reader uses AISStream's documented WebSocket endpoint and `ws` with `perMessageDeflate`; the request deadline starts before opening the socket. Fixed error codes/messages do not include raw provider errors or key values.
- Added a 15-second collector with a 100-unique-valid-vessel cap, PositionReport validation, newest-report-per-ID deduplication at millisecond precision, and cleanup on success, timeout, errors, disconnects, and cancellation. Failures do not return partial vessels.
- Added a PositionReport converter using the sample as its reference and preserving the shared `Vessel` contract.
- Added a synthetic PositionReport fixture and provenance. It is not a live AISStream message.
- Reused the Sprint 01 map markers and vessel card. The new button replaces the latest attempt, clears selection/data while loading, distinguishes success/empty/error states, and labels AIS results as an incomplete sample. The demo timer stops on the first request and resumes only after page refresh. Error rendering maps recognized codes to fixed local copy and uses the internal-error copy for unknown codes. The map receives a one-time initial-view reset key on the first nonempty success.

## Verification performed

- `npx playwright test` — passed, **31 tests** (`31 passed (7.7s)` after client error hardening). This includes the original B-07 selection checks, reader lifecycle tests, converter checks, and UI tests. UI tests stub `/api/snapshot`; they do not use live AISStream data.
- `npm run build` — passed after the Sprint 02 implementation; Next.js 16.3.7 generated `/`, `/_not-found`, and the dynamic `/api/snapshot` route.
- `git diff --check` — no output/errors.
- `git ls-files .env.local` — no output; no `.env.local` is tracked.
- A filename-only search of `.next/static/chunks` found no `AISSTREAM_API_KEY`, AISStream WebSocket URL, or `perMessageDeflate` references in client chunks.
- The no-key route response was exercised directly; it returned HTTP 502 with `no_api_key` and the fixed Ukrainian message.
- A one-off injected-source/clock harness manually exercised deadline-before-subscription, window-expiry empty success, 100 unique IDs, duplicate/newer/older/equal-timestamp behavior, ignored subscription-control frames, failure after partial input, disconnect, cancellation, one-time completion, and cleanup. These collector-rule checks are manual for Sprint 02; no persistent automated collection-rule test suite was added (that coverage is R3 work).
- The converter fixture was checked against its mapping: MMSI→ID, PositionReport latitude/longitude→coordinates, Sog→speed, and the nanosecond timestamp→ISO milliseconds.
- The browser test confirms the initial-view reset key is requested once on the first nonempty result and remains unchanged on later results. A physical pan-and-preserve viewport check was not completed.

## Limitations and unverified checks

- No AISStream key was configured or used; no live connection was attempted and no live message was received. The saved sample is synthetic and must not be presented as actual traffic.
- The `.claude/settings.json` deny patterns are present and their JSON structure was validated without displaying the file contents. The dummy `.env.local` access-deny probe was blocked by the tool security guard, so effective permission enforcement was not dynamically verified.
- Provider documentation describes a `SubscriptionConfirmation` control frame despite Sprint 02's assumption that no confirmation is sent. B-09 returns the first raw frame; the final collector ignores non-PositionReport control frames.
- The sample provenance documents the difference between the provider example's uppercase metadata coordinates and Sprint 02's lowercase description. The converter uses PositionReport coordinates; `time_utc` follows Sprint 02 because the current provider documentation does not establish that field path.
- This checkpoint and implementation are uncommitted; no commit was requested or created.

This is a teaching demonstration, not a navigation or monitoring system.
