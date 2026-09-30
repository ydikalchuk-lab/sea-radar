# Sprint 02 R2 AISStream Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Sprint 02 release R2: request a bounded AISStream position snapshot on demand, show the latest attempt on the existing Dover Strait map, and preserve the demo experience until the first request.

**Architecture:** Keep the shared `Vessel` contract and existing Leaflet marker/card rendering. Put API key access, AISStream socket lifecycle, PositionReport conversion, and collection behind server-only modules and a Node.js Route Handler; inject the clock and event/socket source at the collection boundary. Make the existing client map component own a small attempt-state machine and stop the demo timer when a request begins.

**Tech Stack:** Node.js 24; TypeScript 6.x (`strict`); Next.js App Router + React; Leaflet 1.9.x; OpenStreetMap Standard tiles; Playwright Test as the only test runner.

**Spec:** `docs/tasks/SPRINT-02.md`; prior release baseline: `docs/checkpoints/CHECKPOINT-02.md` and shared contracts in `docs/tasks/SPRINT-01.md`.

## Global Constraints

- Keep Sprint 01 demo data usable without an AISStream key; do not add future-sprint features or unrelated refactors.
- Keep `AISSTREAM_API_KEY` server-only. Never read, print, commit, or expose real secrets in source, logs, terminal output, API responses, client bundles, or delivered files.
- Before configuring a real key, establish and test the exact `.claude/settings.json` deny rules with a fabricated dummy secret file; never use the real key in a chat.
- Use the single fixed Dover Strait region from `src/config/app.ts` and the exact HTTP/UI/error contracts and Ukrainian copy in Sprint 02.
- Collect for at most 15 seconds (including connection and subscription), stop at 100 unique valid vessels, retain the newest report per ID at millisecond timestamp precision (first accepted on ties), and never return partial data as success after errors/disconnect/cancellation.
- Always settle once and clean up sockets/timers. Preserve existing vessel/card display semantics; do not animate live vessels.
- Collection-rule automated tests are deferred to R3; verify and record those rules manually in the Sprint 02 checkpoint. Do not misstate test coverage.
- For Next.js edits, read the relevant installed documentation under `node_modules/next/dist/docs/` before writing code, as required by the root `CLAUDE.md`.
- Do not run a live request until a human has reviewed the server code that reads the key. Do not claim a live message was received unless it actually was.

## File Structure

- Modify `.gitignore` and `.claude/settings.json` for local-key exclusion and precise secret-file read denials; create `.env.example` with a blank key entry.
- Add `src/lib/aisstream/key.ts` for safe missing/present key access; `src/lib/aisstream/reader.ts` for server-side socket lifecycle; `src/lib/aisstream/position-report.ts` for sample-grounded conversion; `src/lib/aisstream/collector.ts` for bounded aggregation; and `src/lib/aisstream/errors.ts` for the fixed outward error code/message mapping. Adjust these proposed paths only to match an established repository convention.
- Add `src/app/api/snapshot/route.ts` for `GET /api/snapshot` on the Node runtime.
- Add `data/samples/position-report.sample.json` and `data/samples/PROVENANCE.md`.
- Modify `src/app/components/DemoMapClient.tsx` for demo/loading/success/empty/error state and request behavior. Modify `src/app/components/LeafletMap.tsx` only if an imperative reset to the configured initial view is needed.
- Reuse `src/types/vessel.ts`, `src/config/app.ts`, `src/lib/vessel-display.ts`, `src/app/components/VesselCard.tsx`, `src/data/demo-vessels.ts`, and existing Playwright configuration/specs. Add focused specs alongside the existing tests; confirm exact test paths in the live tree before editing.
- Create the Sprint 02 checkpoint(s) at the existing repository checkpoint location, following the factual style in `docs/checkpoints/CHECKPOINT-02.md`.

## Review Focus

1. **Secret isolation:** no secret file is read during implementation; `.env.local` is ignored and untracked; deny rules block `.env`, `.env.local`, `.env.*.local` but permit `.env.example`; no key appears in client output, logs, or any API response.
2. **Socket and deadline lifecycle:** subscription is sent immediately on open; the 15-second clock includes connection/subscription; every outcome closes the socket and clears timers; late events cannot alter a settled result.
3. **Message normalization:** converter follows the saved sample; bad MMSI/time/position is rejected without a fake coordinate; bad/missing Sog/Cog becomes `null`; ties preserve the first accepted report.
4. **Snapshot integrity:** cap counts only unique valid vessels; one complete newest Vessel per ID; errors/disconnect/cancellation discard all accumulated vessels; empty normal completion is a success distinct from an error.
5. **UI state and meaning:** on request the demo timer stops and demo vessels/selection/card clear; one request button is disabled while loading; success/empty/error text is literal Sprint 02 copy; every real snapshot is called incomplete; failure leaves the map empty; live positions do not animate.
6. **Map and card reuse:** retain R1 marker and card behavior, and reset the viewport only for the first nonempty successful snapshot.

---

### Task 1: B-08 — Safe key configuration and access

**Files:**
- Create: `.env.example`, `src/lib/aisstream/key.ts`
- Modify: `.gitignore`, `.claude/settings.json`
- Test: use a fabricated local dummy file for the permission test; do not create/read a real key file.

**Interfaces:**
- Produces `getAisstreamApiKey(): string | null`, implemented in a server-only module; blank/missing values return `null` without throwing or logging.
- Produces narrowly scoped permission denies for `Read(./.env)`, `Read(./.env.local)`, and `Read(./.env.*.local)` while leaving `Read(./.env.example)` available. Verify exact settings syntax against the installed CLI version before editing.

- [ ] **Step 1: Inspect `.gitignore` and `.claude/settings.json` before changing either.** Preserve unrelated existing rules and settings.
- [ ] **Step 2: Add the blank sample configuration and ignore local env files.** `.env.example` must contain exactly `AISSTREAM_API_KEY=`; `.env.local` must remain untracked.
- [ ] **Step 3: Add the server-only accessor and deny rules.** Do not log the value or introduce a client import path.
- [ ] **Step 4: Verify with a dummy file and Git.** Confirm `.env.local` read is denied, `.env.example` read is allowed, and `git ls-files .env.local` outputs nothing. Do not create or inspect real credentials.
- [ ] **Step 5: Review B-08 diff.** Confirm no real key or unrelated permission change is present before proceeding.

---

### Task 2: B-09 — AISStream raw reader and intermediate endpoint

**Files:**
- Create: `src/lib/aisstream/reader.ts`, `src/lib/aisstream/errors.ts`, `src/app/api/snapshot/route.ts`
- Modify: dependency files only if Node 24's available WebSocket support is insufficient.

**Interfaces:**
- Define `SnapshotErrorCode = 'no_api_key' | 'connect_failed' | 'provider_error' | 'disconnected' | 'internal'` and a mapper to the exact fixed messages in Sprint 02; never forward raw provider text.
- Reader consumes the API key, fixed bounds from `APP_CONFIG`, an AbortSignal, an injectable clock/timer, and an injectable socket factory/event source. It produces the first raw message or `null` on live-connection deadline, along with `collectedAt`; errors use the stable internal codes.
- Route exports `GET`, declares `runtime = 'nodejs'`, and returns the interim `{ ok: true, raw, collectedAt }` or specified `{ ok: false, attemptedAt, error }` response.

- [ ] **Step 1: Read the installed Next.js Route Handler/Node runtime docs and current AISStream docs.** Verify URL, subscription object, event behavior, and sample retention constraints; keep the source and clock injectable.
- [ ] **Step 2: Choose the smallest supported WebSocket implementation.** Prefer built-in Node support if compatible; add only a minimal server-side dependency if required and document the reason.
- [ ] **Step 3: Implement reader setup and immediate subscription.** Start the deadline at request processing start; on `open`, send `{ APIKey, BoundingBoxes: [[[lat_sw, lon_sw], [lat_ne, lon_ne]]], FilterMessageTypes: ['PositionReport'] }` immediately, with the fixed bounds from app config.
- [ ] **Step 4: Implement all reader terminal paths.** First raw message, `raw: null` at deadline only while socket/subscription are live, connect timeout/error, provider error, disconnect, request abort, and internal exception must settle once, close the socket, and clear all timers.
- [ ] **Step 5: Add the Node route and interim shape.** No-key request must produce HTTP 502 with `no_api_key`; the route never logs the key or returns it.
- [ ] **Step 6: Verify without live credentials.** Drive the injected fake source through open/message/timeout/error/disconnect/abort and inspect response codes/shapes. Confirm a raw socket error string is not reflected in the public message.
- [ ] **Step 7: Review B-09 diff.** Confirm server-only imports, runtime declaration, deadline inclusion, and cleanup paths.

---

### Task 3: B-10 — Sample and provenance

**Files:**
- Create: `data/samples/position-report.sample.json`, `data/samples/PROVENANCE.md`

**Interfaces:**
- Sample is a PositionReport-shaped JSON fixture used as the converter's field-spelling/reference input.
- Provenance clearly says whether it was received live; if not live, identify it as documentation-derived or synthetic.

- [ ] **Step 1: Select a legally retainable sample.** Use a live message only after human review of the B-09 key-reading server code and explicit go-ahead for the live request; otherwise use a docs or synthetic sample.
- [ ] **Step 2: Save the sample without adding source-identifying secrets or unrelated vessel history.**
- [ ] **Step 3: Record provenance.** Include UTC acquisition time if live, area, live/non-live status, and differences from provider documentation; distinguish connection-opened, message-received, and local-code-verified facts.
- [ ] **Step 4: Review sample and provenance together.** Verify the fixture structure is safe to share and accurately labeled.

---

### Task 4: B-11 — PositionReport conversion and validation

**Files:**
- Create: `src/lib/aisstream/position-report.ts`
- Test: focused converter checks in the existing Playwright Test setup if the established test layout supports them; otherwise perform the spec-required manual comparison without adding a second runner.

**Interfaces:**
- `convertPositionReport(raw: unknown): Vessel | null` maps a valid sample-shaped PositionReport to `Vessel` with `source: 'aisstream'`; rejected messages return `null`.
- Normalize `MetaData.time_utc` to ISO 8601 with milliseconds; compare/report timestamps at millisecond precision.

- [ ] **Step 1: Implement shape guards and mappings from the saved sample.** `MetaData.MMSI` becomes `id`; trimmed `ShipName` becomes a name or `null`; `Message.PositionReport.Latitude/Longitude` become coordinates; `Sog`/`Cog` become speed/course.
- [ ] **Step 2: Reject invalid identity, time, or position.** Require nonempty MMSI and parseable time; accept only numeric latitude in `[-90, 90]` and longitude in `[-180, 180]`; reject AIS unavailable sentinels 91/181 and never substitute 0,0.
- [ ] **Step 3: Normalize optional motion fields.** Speed outside `[0, 102.2]`, missing, or nonnumeric becomes `null`; course outside `[0, 360)`, missing, or nonnumeric becomes `null`, without rejecting an otherwise valid position.
- [ ] **Step 4: Verify sample mappings.** Manually compare at least three output fields with the fixture. Check invalid position rejection and speed zero versus unavailable/null.
- [ ] **Step 5: Review B-11 diff.** Ensure external strings are treated as data and no HTML/code interpretation is added.

---

### Task 5: B-12 — Bounded collection and final response

**Files:**
- Create: `src/lib/aisstream/collector.ts`
- Modify: `src/app/api/snapshot/route.ts`, `src/lib/aisstream/reader.ts`, and `src/config/app.ts` only as required to hold the 15-second and 100-vessel constants in one config location.

**Interfaces:**
- `collectSnapshot({ signal, now, setTimer, clearTimer, openSource, windowMs, maxVessels })` consumes an injected event source and clock and produces a discriminated success (`window_elapsed` or `limit_reached`) or failure result.
- Success API body is `{ ok: true, vessels, collectedAt, windowSeconds, count, truncated, reason }`; failure body is `{ ok: false, attemptedAt, error: { code, message } }` with HTTP 502.

- [ ] **Step 1: Add the shared 15-second and 100-vessel configuration values.** Start the time window before connecting so DNS/connect/subscription time is included.
- [ ] **Step 2: Implement valid-vessel accumulation and deduplication.** Invalid messages are ignored; count unique IDs only; replace a vessel as a whole only when its timestamp is later at millisecond precision; keep the first accepted object on ties.
- [ ] **Step 3: Implement normal completion.** End at window expiry with success even for an empty vessel list; end immediately at 100 unique valid vessels with `truncated: true` and reason `limit_reached`; otherwise use `truncated: false` and reason `window_elapsed`.
- [ ] **Step 4: Implement failure and cleanup behavior.** Provider errors, premature disconnect, cancellation, and internal errors discard the accumulated set; every branch is idempotent, closes resources/clears timers, and ignores late events.
- [ ] **Step 5: Wire final route response and independent-request behavior.** No in-memory vessel state may leak across requests. Preserve `attemptedAt` from the injected clock for errors and `collectedAt` for successful collection.
- [ ] **Step 6: Manually exercise the collection contract with an injected event source/clock.** Verify duplicate ID, older timestamp, equal timestamp, invalid data, 100 distinct valid IDs, empty timeout, provider failure after partial input, disconnect, cancellation, and one-time completion. These checks are manual and must be described as such; do not claim the deferred R3 automated collection tests.
- [ ] **Step 7: Review B-12 diff.** Confirm no partial data is serialized after failure and timers/sockets close on all outcomes.

---

### Task 6: B-13 — Latest-attempt UI with existing map and card

**Files:**
- Modify: `src/app/components/DemoMapClient.tsx`
- Modify only if required: `src/app/components/LeafletMap.tsx`, its current test specs, and shared API response types in an appropriate existing type file.

**Interfaces:**
- Client attempt state is one of `idle-demo | loading | success | empty | error`; the client uses `GET /api/snapshot` and the response contracts from Task 5.
- `LeafletMap` continues receiving the same `Vessel[]`, selected ID, and selection callback; add a narrow map-view reset interface only if the existing map API cannot reset to `APP_CONFIG` initial view.

- [ ] **Step 1: Replace demo-only render state with the five explicit attempt states.** Keep the demo interval active only in `idle-demo`; clean it up as soon as a snapshot attempt starts.
- [ ] **Step 2: Add the single specified request button and loading transition.** On click clear current vessels, selection, and card immediately; set loading status and disable the button while awaiting the endpoint.
- [ ] **Step 3: Map response to success, empty, or error without stale data.** On a successful nonempty response display its vessels; on empty success display no vessels and the exact empty message; on any failure leave no vessels and use the response's `attemptedAt`/fixed message.
- [ ] **Step 4: Render exact status text and metadata.** Use literal Sprint 02 strings, successful time as `HH:MM:SS UTC`, counts and 15-second configured window, incomplete-sample wording, and the limit suffix only when truncated. Do not label empty success as “no vessels in area.”
- [ ] **Step 5: Preserve map/card behavior and reset only once.** Reuse existing marker/card components. On the first nonempty success only, reset to `APP_CONFIG` center/zoom; later requests preserve the user's viewport. Do not animate AIS vessels; demo resumes on full page refresh only.
- [ ] **Step 6: Add focused browser coverage and retain B-07 assertions.** Block OSM tiles before navigation as existing tests do. Check literal button, disabled loading state where deterministically controllable, empty/success/error state render, clearing selected demo vessel, and marker/card correlation for a stubbed MMSI response; do not use live data in deterministic browser tests.
- [ ] **Step 7: Verify manually in the browser.** Verify missing-key copy; after the human has reviewed the server key-reading code and configured credentials outside chat, correlate one actual response MMSI with its marker/card. If live service/key is unavailable, record that limitation rather than claiming live verification.
- [ ] **Step 8: Review B-13 diff.** Confirm exact copy, view reset timing, demo-timer cleanup, and no retention of prior vessels on error.

---

### Task 7: Sprint 02 review and checkpoint

**Files:**
- Create: `docs/checkpoints/CHECKPOINT-03.md` and `docs/checkpoints/CHECKPOINT-04.md` at the respective accepted milestones, if following the sprint's two checkpoint gates.
- Modify: no unrelated application files.

- [ ] **Step 1: Run `git diff --check` and inspect the full diff against B-08–B-13.** Confirm no secret file/value, extra dependency, future-sprint placeholder, or unrelated refactor.
- [ ] **Step 2: Run `git ls-files .env.local`.** Expected output is empty.
- [ ] **Step 3: Run `npx playwright test`.** Expected: all existing and Sprint 02 UI tests pass; report exact count/output.
- [ ] **Step 4: Run `npm run build`.** Expected: production build succeeds with Node route and client-only Leaflet; report actual result.
- [ ] **Step 5: Review client artifacts and API responses for secret leakage.** Confirm key is neither bundled nor returned; do not print any secret while checking.
- [ ] **Step 6: Complete manual acceptance checks.** Sample provenance and field comparison; dummy-file permissions; no-key behavior; incomplete sample language; independent snapshots; failure clears map and returns no partial vessels; first-success viewport reset; second-success viewport preservation. Record unverified live conditions honestly.
- [ ] **Step 7: Write factual checkpoints.** Separate observed/manual checks, automated test coverage, actual command results, and anything not verified; explicitly state collector-rule checks are manual and automated coverage is R3.
- [ ] **Step 8: Review the final diff and checkpoint content.** Do not commit unless separately requested.

## Acceptance Summary

- B-08: safe key configuration and tested permissions, without reading any real key.
- B-09/B-10: documented AISStream reader behavior, stable interim endpoint, and accurately labeled sample/provenance.
- B-11/B-12: valid PositionReport conversion and bounded snapshot semantics with no partial-success failure mode.
- B-13: existing map/card render the latest attempt with exact copy; demo remains available until the user requests live data.
- Verification: existing Playwright coverage and production build pass; secret boundaries and manual collector rules are reported truthfully.
