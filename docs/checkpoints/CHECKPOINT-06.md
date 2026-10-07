# Checkpoint 06 — Sprint 03 R4 final verification

**Recorded:** 2026-10-07

**Branch:** `feat/sprint-03-r3-test-evidence`

**Starting point:** Checkpoint 05; HEAD before R4 implementation: `9ce648a`.

## Delivered

- Split the displayed vessel set and the latest request result into independent UI state. The map keeps its demo set or last nonempty AIS snapshot during pending, error, and empty results.
- Demo vessels continue moving during a request and after unsuccessful or empty results. Only a nonempty success replaces the displayed set and stops demo motion.
- Source label describes the set currently shown. Attempt status is reported separately, with timestamps from `collectedAt` or `attemptedAt` in the response. An unparseable/no-body response gets the fixed no-response copy without a browser timestamp.
- A selected vessel card updates when its ID is present in a replacement snapshot and closes when its ID is absent. Later snapshots do not reset a shifted map view.
- Added the persistent page-refresh hint and arranged the snapshot controls, labels, attempt status, hint, and card in the requested order.
- Added README instructions for setup, local configuration, use, verification commands, behavior on failed attempts, and data limitations.
- Automated UI tests cover the R4 acceptance scenarios. Existing demo-motion and vessel-selection tests were left unchanged. `tests/vessel-map.spec.ts` has a locator-only adjustment for the demo source label because the new required hint contains the same text; the assertion still checks the exact source-label content.

## Verification

- `npm ci` — passed; installed 37 packages. npm reported one high-severity advisory, recorded below.
- `npx playwright install chromium` — passed.
- `npx playwright test` — passed, **62 tests** (37 Node-project and 25 Chromium-project tests).
- `npx tsc --noEmit` — passed without diagnostics.
- `npm run build` — did not run successfully in this Windows environment: Windows Application Control blocked the native SWC binding required by Turbopack.
- `npm run build -- --webpack` — passed; routes `/`, `/_not-found`, and `/api/snapshot` were generated.
- The default dev-server command had the same native Turbopack restriction; `npm run dev -- --webpack` started successfully for browser tests.
- `git diff --check` — passed.
- `git ls-files -- .env.local` — no tracked `.env.local` entry.
- Independent read-only review of the implementation — no actionable findings.

## Manual acceptance evidence

- **Without a configured key:** at **08:51:53 UTC**, the UI displayed `Спроба 08:51:53 UTC: не вдалося отримати дані: Ключ AISStream не налаштовано`. The user confirmed demo vessels remained visible and continued moving.
- **With a configured key:** at **08:48:21 UTC**, the UI displayed `Спроба 08:48:21 UTC: не вдалося отримати дані: Не вдалося підключитися до джерела`. This records an unsuccessful connection at that time; it does not establish persistent source availability or unavailability.
- **Secret search:** the user reported no matches in the checked working copy, `.next/static`, and archive. Local environment files were not read or included in this checkpoint archive.

## Security and limitations

- `npm audit` reports high-severity **GHSA-68fv-2mgg-jv7q** in transitive dependency `source-map-js@1.2.1`, reached through `next@16.3.7` → `postcss@8.5.23`. The advisory describes event-loop denial of service via indexed source-map section offsets. `npm audit --omit=dev` reports it as well. npm indicated `1.2.2` as the available fix.
- No dependency fix was applied; `package.json` and `package-lock.json` remain unchanged. A dry-run suggested `1.2.2` but changed the installed package; `npm ci` restored the installed dependency to the lockfile version `1.2.1`.
- Live-source results are a single manual attempt only. Automated browser tests stub `GET /api/snapshot` and do not establish AISStream connectivity or data completeness.
- No key or local environment-file contents were read, copied into the repository, or included in this archive.
