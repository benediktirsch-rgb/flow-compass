# Cloud-owned operations and reception monitoring

The systemd `compass-monitor.timer` runs every two minutes as a server-owned job.
No Windows machine, SSH session, or desktop heartbeat is needed for these checks.
The service starts only the own Compass service and existing source timers if
inactive. It never restarts healthy services or changes customer instances.

`cloud_monitor.py` checks real source success timestamps, underlying mail/Slack
snapshot timestamps, and actual publication success. It reads reception answers,
updates the private decision ledger under the shared lock, and atomically stores
answer events before committing the ledger. Replaying after a crash does not
duplicate an event. Changed human answers are preserved as new events.

An answer event means **received**, never **executed**. The original source task
must still interpret the exact authorized scope and perform its work. The cloud
collector includes the answer events and monitor status in its normal briefing
context through the protected `/api/rueckfragen` endpoint. No messages, publishing,
purchases, or other business actions are inferred from an answer.

Private files in the existing `vertretung` directory:

- `cloud-monitor.json`: actual check and success times, source health, coverage.
- `decision-events.json`: durable answer events, keyed by question and answer hash.
- `desktop-task-import.json`: explicitly dated imported task inventory and gaps.

The last file is a snapshot, not remote access to desktop conversations. Codex
desktop tools are tied to their connected hosts. Moving a local task's execution
requires a connected remote host and matching project, followed by supported
handoff. A copied inventory does not move its working tree or create live sync.
Future server tasks should use `/opt/compass-vertretung/decisions.py` directly.

Install the Python file beside `decisions.py`, with owner root/group compass and
mode 0640. Install the two unit files, daemon-reload, enable/start the timer. The
service loads the existing own EnvironmentFile. No new credentials or public
listeners are introduced. Only the own Compass service needs restarting when the
questions API module changes. Back up and compare live files before replacement.

Tests: `python3 tests/cloud_monitor_test.py wolkenserver/cloud_monitor.py` under
Linux. Verify a timer-triggered run after ending the installing SSH session and
read `cloudMonitor` through the protected Compass HTTPS API. Keep the optional
desktop task exporter distinct from server operations; stopping the desktop must
not stop source collection, reception capture, or health checks.
