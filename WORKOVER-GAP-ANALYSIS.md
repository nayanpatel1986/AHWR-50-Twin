# Workover / Well-Service Rig Monitoring — Gap Analysis

**Scope:** This re-assesses the ROM-II / AHWR digital twin as **workover / well-service
rig monitoring software** (the rig is an Anchor/Hydraulic Work-Over rig — PCT power
casing tong, HTD hydraulic top drive, ACS anti-collision, HPU, anchor/hydraulic hoist,
fishing operations), **not** full drilling automation.

**Reference systems benchmarked:** NOV mobile/workover rigs (4C–7C/7T, D500/D700
drawworks) & **RigSense** EDR, NOV **WellData/RDM** remote monitoring, Drillmec mobile
rigs & **ProRig** cloud/IoT asset monitoring, McCoy **torque-turn** systems, **API RP 54**
(drilling & well-servicing safety), **WITSML/WITS** (Energistics) data exchange.

---

## Coverage vs the 10 required feature areas

| # | Feature area | Status | Evidence / gap (workover lens) |
|---|---|---|---|
| 1 | **Real-time rig dashboard** | 🟢 Strong | Hook load, block position, depth, HPU hydraulic pressure/temp/pump, CAT engine RPM/fuel/oil/coolant, **crown/floor-saver** (ACS) live. Gaps: block shown as animation not real position / **line speed**; no **drawworks drum RPM / brake-temp**; no **mast load**; charts time-only (acceptable for workover). |
| 2 | **Workover operation monitoring** | 🔴 Missing | `operation_mode` is a **drilling enum** (DRILLING/TRIP IN/TRIP OUT/CASING). No tubing/rod running, swabbing, cleanout, milling, packer setting, rig-up/down/move/wait **NPT** states. Fishing 🟡 partial. |
| 3 | **Pressure / flow / fluid** | 🟡 Partial | Have SPP/pump pressure, SPM, total strokes, flow-in (L/min), pit tanks + total, **trip-tank gain/loss**. Missing workover core: **tubing / casing / wellhead pressure**; pumped-volume totalizer; flow-out is **%** (not volumetric); fluid density/temp. |
| 4 | **Tubular & tong** | 🟡 Data only | PCT make-up/break-out + last torque captured & shown. Missing the torque-turn **system**: no torque-vs-turn graph, no make-up **limits / pass-fail**, no **joint count / pipe-&-rod tally**, no string records or connection-quality report. |
| 5 | **Safety & alarm** | 🔴 Unmanaged | Overpull + pump-overpressure (Fishing, hardcoded), crown/floor-saver banners, honest NO-DATA exist but isolated. Missing high-hook-load, accumulator-low, flow gain/loss, E-stop, gas/H2S/LEL, and any alarm **management** (priority, acknowledge, audible, history) — **API RP 54** needs auditable records. |
| 6 | **Reports & job records** | 🔴 Missing | Only raw xlsx from Trends. No daily workover report, tour sheet, IADC, NPT, pumping, **torque-turn**, pressure-test, **pull/run tally**, maintenance report; no PDF/cloud. |
| 7 | **Remote monitoring & fleet** | 🔴 Single-rig | Web app (office-accessible) but no multi-rig **fleet map**, job-status board, SMS/email/app alerts, historical **replay**, remote support. |
| 8 | **Integration & data standards** | 🟡 Partial | ✅ Modbus TCP + S7comm, ✅ REST. ❌ OPC UA, CAN/**J1939**, MQTT, **WITS/WITSML**. |
| 9 | **Maintenance & asset health** | 🟡 Partial | Engine/HPU run-hours + a PM panel (limits hardcoded, hours in localStorage). ❌ drawworks/pump hours, brake-temp trends, calibration history, spares log, **downtime reason codes**. |
| 10 | **Retrofit support (Cardwell-class)** | 🟢 Good fit | Telegraf + Modbus/S7 + admin PLC-config UI is exactly the retrofit pattern — add load cell / encoder / transducers / stroke counters / tank levels / tong-torque over Modbus. Docker stack runs on a rugged edge box with local InfluxDB (offline-capable). ❌ J1939/CAN gateway, ❌ cloud sync. |

## Re-scoping vs the drilling-lens review

**De-prioritized for workover** (over-scoped before): depth-indexed drilling log, MSE /
d-exponent, ECD/ESD, mud-gas chromatography, solids-control (shakers/degasser/desander),
per-pump triplex modeling, genset-fleet/SCR-VFD, lag/bottoms-up strokes. A workover rig
circulates and trips tubing/rods — it isn't making hole.

**Rises to the top for workover:** alarm **management** (overpull, hook-load, accumulator,
pressure, gas — API RP 54 auditable) · **torque-turn** system · **workover activity + NPT**
tracking · **tubing/casing/wellhead pressure** · **pull/run tally + daily workover report**
· **fleet/remote + alerts** · **WITSML + J1939** integration.

## Against the recommended MVP

| MVP item | Today |
|---|---|
| Real-time dashboard | 🟢 have |
| Hook load / depth / pressure / pump / tong data | 🟡 hook/depth/pump/tong ✅; tubing/casing pressure ❌ |
| Alarm system | 🔴 scattered, no management |
| Job activity tracking | 🔴 drilling enum only |
| Daily workover report | 🔴 none |
| Cloud sync + offline mode | 🟡 offline-capable; no cloud sync |
| Maintenance log | 🟡 partial (localStorage) |
| CSV / PDF export | 🟡 CSV/xlsx only, no PDF |
| Modbus / J1939 / WITSML-ready | 🟡 Modbus/S7 ✅; J1939/WITSML ❌ |

**Net: ~40–50% of the workover MVP.** The real-time + retrofit foundation is solid; the
workover-defining layer (activity/NPT, torque-turn, tubing/casing pressure, alarm
management, daily report, fleet/remote) is what's missing to match a NOV Cardwell /
RigSense / Drillmec ProRig–class product.

## Build priority (MVP increment)

1. **Workover activity + NPT tracking** — replace the drilling op-mode with a workover
   activity model (RIH/POOH/make-up/break-out/circulate/rig-up/down/wait…), auto-classified
   from signals with manual override, persisted as a timestamped timeline with NPT reason codes.
2. **Alarm management** — master alarm DB (per-tag Hi/HiHi/Lo/LoLo + priority + deadband
   + on-delay), state machine (unack→ack→RTN), persistent banner + alarm list + history,
   acknowledge/silence, audible annunciation.
3. **Tubing/casing/wellhead pressure + torque-turn** — pressure channels + panel; capture
   make-up torque vs turns, evaluate against limits, record connection quality + joint tally.
4. **Daily workover report** — built from the activity time-log, connections, and alarms,
   plus manual header/remarks; PDF (print) + CSV export.

Later: fleet/remote + alerts, WITSML/J1939 integration, maintenance/asset-health,
historian replay, cloud sync.
