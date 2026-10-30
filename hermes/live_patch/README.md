# Hermes production correction, 2026-10-30

This is an overlay for the existing `macro_waves` and `hermes_v091` packages,
not the isolated Phase 1 engine in `hermes/src`. The Phase 1 engine has not been
connected to production by this correction.

Live release: `/opt/hermes-analysis/data/runtime_v091/elliott-evidence-20261030`.
The release contains a complete snapshot of the previous active packages plus
these replacement modules. The service drop-ins select its `src` directory.

## Changes

- Removed manual market-signal overrides from publication and retired the live
  override file with a backup. There is no fallback to those values.
- Removed forced monthly-B interpretations, automatic bearish relabelling,
  cross-timeframe price snapping, stop widening and best-fit Fibonacci arithmetic.
- Every model transport receives the same evidence contract. Counts declare a
  pattern and a Fibonacci method; CPU calculations record exact anchors and formulae.
- Model validation rejects changes to facts rather than repairing the count.
- Classical impulse endpoint rules include intermediate wicks and the origin.
  Endpoints do not prove internal subdivisions, diagonals or correction types;
  insufficiently verified patterns remain conditional and cannot produce a trade.
- Target touches, invalidation and expiry are separate lifecycle events.
  Terminal scenarios cannot reactivate after a bounce. Same-candle target/stop
  ambiguity does not become a claimed success. Alerts replay closed candles.
- Every timeframe needs its own case. Daily targets cannot populate a 30M chart.
- The app and Telegram use the same validated plans. Invalid legacy cases show
  WARTEN, with no target, entry or wave overlay.
- Live roles require an owner-controlled qualification result for their exact
  role/model combination. A missing or failed result blocks that role. Existing
  deterministic degraded operation is explicit; no new unchecked model is substituted.

## Verification and limits

35 regression/compatibility tests passed on Windows and on the production Python
environment before activation. TypeScript, ESLint and the Next.js production build
passed for the dashboard changes.

All 20 configured role/model combinations were probed with 15 fixed synthetic
questions. Results: 12 passed, 6 had incorrect answers, 2 had no usable response.
The initial GPT probe accidentally used the generic schema-output transport;
only those seven transport failures were repeated using their production routed
transport. The Codex supervisor was also repeated after adding the confidence
field required by its productive adapter to the probe schema. The original
records remain on the server. Failed factual
answers were not retried into passing results.

See `audits/2026-10-30-agent-audit.json` for answers and grading and
`audits/2026-10-30-activation.json` for source hashes and the backup location.
The probe is a limited competency sample, not proof of future performance or a
certification that a model understands every Elliott structure.

The snapshot previously published for BTC, ETH and SOL lacks the new provenance
contract. All three app records were republished as WARTEN. The installer sent no
Telegram messages. A fresh qualifying count is required before directional output
can return; unsupported 30M counts are not invented.

## Running the tests

Overlay these files on a copy of the active runtime, then use that complete copy
as `PYTHONPATH` and run:

```sh
python -m unittest discover -s tests -v
```

`tools/audit_agents.py` uses the configured live model accounts and makes one
bounded request per role. Its result file is resumable. It does not publish.
`tools/install_release.py` is restricted to the documented server release path,
backs up changed state and selects the tested release. `tools/verify_live.py`
checks actual module origins and Supabase payload versions without exposing keys.

For rollback, use the saved `dropins.json` and report/state snapshots in the
activation backup, reload systemd and restart the inbox. Do not reinstate the
retired signal overrides: they are the source of the incorrect signals.

## Rule references

The endpoint checks and documented limits were checked against Elliott Wave
International's primary educational references:

- https://www.elliottwave.com/waveopedia/impulse/
- https://www.elliottwave.com/waveopedia/motive-waves/
- https://www.elliottwave.com/waveopedia/elliott-wave-pattern-diagonals/
- https://www.elliottwave.com/waveopedia/zigzags/
- https://www.elliottwave.com/waveopedia/flats/
