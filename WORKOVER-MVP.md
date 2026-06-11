# Workover MVP — implemented features

This increment adds the workover-defining layer identified in
[WORKOVER-GAP-ANALYSIS.md](WORKOVER-GAP-ANALYSIS.md). All four priority items are
built, wired to live data, role-gated, and verified in the local Docker stack.

Open the app at **http://localhost:8080**, sign in, and use the nav for **Activity,
Alarms, Workover, Reports**. The mock generator drives a scripted workover cycle
(RIH → make-up → circulate → POOH → break-out) so every feature is demonstrable
without a physical PLC.

## 1. Workover activity + NPT tracking  (`/activity`)
- Auto-classifies activity from live signals (block travel, pump rate, tong sequence):
  `RIH, POOH, MAKE_UP, BREAK_OUT, CIRCULATE, SWAB, FISHING, RIG_UP, RIG_DOWN, IDLE, WAIT`.
- **Manual override** (operator/admin): set the activity, choose an **NPT reason**
  for non-productive time, or **Return to Auto**.
- Timestamped **timeline** with per-entry duration + depth, and a **productive vs NPT**
  roll-up for the day. Transitions persist to `activity_log.json`.

## 2. Alarm management  (`/alarms` + persistent AppBar banner)
- Master setpoint DB (`alarms_config.json`) with per-tag **HiHi/Hi/Lo/LoLo + deadband
  + on-delay + priority**, evaluated server-side each tick.
- ISA-18.2-style **state machine**: `UNACK → ACK → return-to-normal`, with **first-out**,
  deadband anti-chatter, and an **event history** (`alarms_events.json`).
- **Persistent banner** on every page (highest priority + active/unack counts),
  **acknowledge / ack-all**, and a **Web-Audio audible annunciator** (armed by the
  speaker toggle to satisfy browser autoplay; per-priority tone/cadence).
- Default workover alarm set: hook-load high, pump/standpipe high, **tubing high**,
  **casing high**, **BOP accumulator low**, **pit gain/loss**, HPU oil-temp high,
  engine oil-pressure low, engine coolant high. (Admins can edit via `PUT /api/alarms/config`.)

## 3. Wellhead pressure + torque-turn  (`/workover`)
- **Tubing / casing / wellhead pressure** gauges (bar) with HI-limit markers, fed by a
  new `wellhead` measurement (`Tubing/Casing/Wellhead Pressure-Bar` added to FIELD_MAP).
- **Torque-turn**: live make-up torque-vs-time chart with min/max limit lines; on each
  PCT make-up sequence the backend records a **connection** (joint #, peak torque,
  PASS/FAIL vs limits), giving a **pull/run tally** (run / pass / fail / joint count).

## 4. Daily workover report  (`/reports`)
- Built from the activity time-log + connections + alarms: editable header, **time
  summary** (productive vs NPT), **depth progress**, **connections** tally, **activity
  breakdown** by code, and **alarms logged**.
- Export: **Print/PDF** (print-styled) and **CSV** (no extra dependencies).

## 5. Maintenance & asset health  (`/maintenance`)
- **Run-hours** per major asset — measured from PLC tags (engine, HPU, top drive) and
  **derived** by accruing time while the condition holds (drawworks while hoisting,
  mud pump while pumping).
- **Preventive-maintenance schedule** with per-task interval, last service, next-due and
  a **due-in / due-soon / overdue** status; a **Service** action resets the task (and
  auto-logs it to the calibration/service history).
- **Calibration history** — auto-captured from the Zero-WOB tare and Set-Depth actions,
  plus manual entries.
- **Downtime / failure log** with standard **reason codes** (mechanical, electrical,
  hydraulic, instrumentation, waiting-on-parts, scheduled-maint, other), severity,
  open/closed state and duration.
- **Asset-health cards** + KPI row (overdue / due-soon / open-downtime counts).

## API (all require `Authorization: Bearer <jwt>`; writes are role-gated)
```
GET  /api/activity/current | /api/activity/codes | /api/activity/log?date=
POST /api/activity/set            {code, npt?}            (operator/admin)
GET  /api/alarms | /api/alarms/history?limit= | /api/alarms/config
POST /api/alarms/:id/ack | /api/alarms/ack-all            (operator/admin)
PUT  /api/alarms/config                                   (admin)
GET  /api/connections?date= | /api/torqueturn/current
GET  /api/report/daily?date= | /api/report/header
PUT  /api/report/header                                   (operator/admin)
GET  /api/maintenance/summary | /pm | /calibrations | /downtime | /reason-codes
POST /api/maintenance/pm/:id/service                      (operator/admin)
POST /api/maintenance/calibrations                        (operator/admin)
POST /api/maintenance/downtime | /downtime/:id/close      (operator/admin)
```
Socket events: `rig_data` now carries `wellhead`, `_activity`, `_alarms`,
`_torqueturn`; plus `alarms` (active list + counts) and `connection_made`.

## Source
- Backend modules: `backend/lib/{alarms,workover,maintenance,persist}.js`; wired in
  `backend/server.js`.
- Mock cycle: `mock/mock-data.js`.
- Frontend: `frontend/src/components/{Activity,Alarms,Workover,Reports,Maintenance}/*`,
  `frontend/src/utils/{format,alarms}.js`; routes in `App.jsx`, banner/nav in `Layout.jsx`.
- Runtime state persists in the `backend_data` Docker volume (`/data`), never committed.

## Not yet (future increments)
Fleet/remote multi-rig + SMS/email alerts, WITSML/J1939 integration, historian replay +
min/max envelopes, per-tag data-quality flags, cloud sync.
