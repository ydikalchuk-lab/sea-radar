# PositionReport sample provenance

- **Source status:** Synthetic fixture, not received from a live AISStream connection.
- **Prepared:** 2026-09-30 UTC.
- **Area represented:** Dover Strait bounds from the Sprint 02 app configuration: 50.75° N, 0.95° E to 51.25° N, 1.95° E.
- **Connection opened:** No live connection was attempted.
- **Message received:** No live message was received. `position-report.sample.json` contains fictional values and is not a record of an actual vessel.
- **Local code verified:** The raw reader's subscription, message, deadline, failure, cancellation, and cleanup behavior was exercised with a fake WebSocket source; the production build passed. This does not verify AISStream connectivity or a live payload.
- **Documentation comparison:** The envelope and the `Message.PositionReport` field names/casing follow AISStream's documented PositionReport example. That example uses `MetaData.Latitude` and `MetaData.Longitude`; Sprint 02's text describes lowercase metadata coordinate names. The converter uses `Message.PositionReport.Latitude/Longitude`, so metadata coordinates are retained here only as sample context. AISStream's documentation does not specify the `time_utc` path; the synthetic fixture uses the path and timestamp form required by Sprint 02.

The sample is explicitly synthetic and must not be cited as proof of a live connection or representative traffic.

## StandardClassBPositionReport sample provenance

- **Source status:** First live AISStream StandardClassBPositionReport captured by the project owner.
- **Captured:** 2026-10-07T12:07:09.237Z
- **Area represented:** English Channel.
- **Filter:** StandardClassBPositionReport only.
- **Secret handling:** AISSTREAM_API_KEY was read from the environment and was not printed or written to disk.
