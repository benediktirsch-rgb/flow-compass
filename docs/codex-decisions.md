# Codex decisions at reception

`wolkenserver/decisions.py` receives a reviewed JSON record on stdin and uses the
existing reception device credential. Run as the service user with its existing
EnvironmentFile. No new credentials, model calls, or business actions are added.

Required fields: `thread` (UUID), `title`, `key` (stable scope identifier), `scope`,
`blocker`, `evidence`, `decision` (`offen`, `erteilt`, `abgelehnt`), `execution`
(`wartet`, `in_bearbeitung`, `abgeschlossen`, `blockiert`), timezone-aware
`observedAt`. Decided records require `answer` (max 200 characters). Optional
`options` and `link` use the existing reception schema. Keep personal content and
credentials out of these records. Use the source task for sensitive detail.

Thread UUID plus stable key determine the reception question ID. Changing scope
requires a new key and a fresh decision. An older observation is rejected. Known
answered or withdrawn questions are never reopened, even after reception retention
expires. Reception answers take precedence over inferred/task-side decisions;
consumers must inspect `receptionStatus` and `receptionAnswer`, not just `decision`.
No business action is authorized by the bridge itself. Reception lacks conditional
answer writes: the bridge rechecks before recording an explicit chat answer, but
cannot provide transactional compare-and-swap across services.

Private ledger: `vertretung/codex-decisions.json`, atomic replacement under a lock,
0600. `--list` returns the ledger plus current reception questions. Successful
writes are acknowledged only after reception readback. The protected questions
endpoint exposes `codexVorgaenge` independently from open questions, so a granted
decision can remain in progress. The collector no longer restores answered or
withdrawn question IDs from the previous stack.

Task discovery is a separate desktop heartbeat: enumerate recent and pinned Codex
tasks, additionally retain source IDs with unresolved decisions/execution, read
changed tasks, compare latest user answers and actual repository status, and submit
only concrete unresolved questions. Persist coverage and read failures. A list
limit, archived tasks, unavailable hosts, empty pages, and offline desktop are
coverage limits, not evidence that no decisions remain. Cloud mail, Slack and
other existing connectors continue independently.

Tests: `python3 wolkenserver/decisions_test.py wolkenserver/decisions.py` on Linux;
existing questions and collector suites include decision visibility and prevention
of stale-question restoration. Deployment adds the bridge script separately;
existing standard server deployment includes the updated questions module. No
customer service restart is required.
