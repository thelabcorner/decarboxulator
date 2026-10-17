# Unified saved library: tracker sessions and calculations

Date: 2026-10-17
Scope: Decarboxulator V4 PR3 branch (preview only until deployment)

## Contract

Tracker runs and calculator snapshots share a single on-device IndexedDB database:
`decarboxulator-v4-tracker`, schema version 2. The database preserves the V1
`sessions` and `meta` stores and adds `calculations`. A tracker run counts as
**one record**, regardless of the number of readings inside it.

**Hard application limit:** 25,565 entries total across both stores, not 25,565
per type. Capacity is checked **inside readwrite transactions** encompassing
both stores, after edits but before commit. A competing browser tab therefore
cannot bypass the cap by reading a stale count. Browser storage quotas and
device resources may impose a lower practical limit.

The application never deletes records or evicts the oldest items to make room.
A full library rejects additions without modifying existing entries. Edits and
deletes can proceed; failed writes are not reported as saved.

## Migrations

- Existing tracker IndexedDB V1 upgrades in place to V2. V1 runs, readings,
  active selection, annotations, and timestamps are retained.
- Saved calculations from `decarboxulator-v4:saved-calculations` or older
  `decarboxulator-v4:history` localStorage archives migrate once into
  IndexedDB. A migration marker is written in the same atomic transaction.
  The original localStorage data is left intact for recovery; clearing the
  new library does not cause the legacy snapshot to be reimported.
- Invalid or unknown records abort import/migration instead of silently
  replacing or dropping stored laboratory records.

## UX and portability

The studio toolbar and the tracker runbar open one shared library drawer.
It searches and sorts both record types, with All / Calculations / Tracker
runs scopes. At most 160 rows render initially; users can reveal subsequent
blocks. Calculator records retain favorites, notes, and original-input links.
Tracker runs expose measurements, run status, reopen/complete, clone setup,
per-run export, and a direct link selecting the exact session.

The shared library exports `decarboxulator-unified-library` V1 JSON containing
both kinds of records. Import accepts this format as well as the original
tracker session, tracker archive and saved-calculation JSON formats.
Duplicate physical runs and duplicate calculation snapshots are skipped.
Conflicting record IDs do not overwrite existing records. Imports are
all-or-nothing per JSON file and do not switch the active tracker run.

Backup import is bounded at 64 MiB to avoid unbounded JSON parsing in a
mobile browser. A full-library export larger than this limit is rejected;
individual tracker-run export remains available. Very large libraries should
be backed up in smaller portions. No cloud synchronization is implied.

## Concurrency and recovery

- Cross-tab notifications use `BroadcastChannel` where available and
  same-window events for local updates. Tracker reads are withheld while
  unsaved local edits are pending or have failed.
- Tracker changes compare each edited record against the last committed
  version inside the database transaction. A changed record in another tab
  aborts the stale write rather than overwriting newer measurements.
- Calculation changes use a serial read-modify-write transaction. Deletion
  undo restores its batch in one transaction and refuses to overwrite an
  independently modified record.

## Verification

- 201 unit tests across 26 test files passed, including V1 schema upgrade,
  one-time saved-calculation migration, imported record round trips,
  stale tracker-write rejection, and exactly 25,565-entry cross-type capacity.
- Chromium/WebKit at 390 px and 1440 px: 40 unified-library browser checks
  passed, covering record selection, migration, combined export, reload, and
  overflow/runtime-error checks.
- Existing tracker lifecycle E2E: passed after migration to the shared drawer.
  It covers measured reading retention, completion/reopening, backup restore,
  legacy tracker recovery, corrupt-record refusal, and mobile/desktop use.
- TypeScript and full production build passed.

## Search Console evidence (provided 2026-10-17)

The screenshots show a 16-month **query table**, not a total traffic report.
Strongest observed searches include "thca to thc calculator" (134 clicks,
1,204 impressions), "thca calculator" (60/234), and
"thca to thc conversion rate" (29/1,608). The long-tail
"decarboxylation calculator" has 2/458 and "decarb calculator" 0/482.
A separate "decarb time calculator" query shows 0/158; the product does
not implement a validated time predictor, so do not imply that it does.

The V4 THCa conversion reference and FAQ now explain the 314.46/358.47
(approximately 0.87723) **mass factor** as distinct from a reaction's speed
or measured efficiency. This directly addresses the conversion formula/rate
ambiguity without promising an unimplemented time-based prediction.
These changes require a production deployment and subsequent indexing
before any Search Console effect can be measured.
