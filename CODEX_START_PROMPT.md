# Copy this into Codex first

Open this repository in Plan mode and use GPT-5.6 Sol with a high reasoning setting.

Read `AGENTS.md` and every file under `docs/` and `codex-tasks/00-plan-and-rfc.md` in full. Inspect the existing repository before making assumptions.

Execute only Task 00 now. Do not implement product features. Produce a repository-specific RFC, ADRs, risk register, and phased execution plan. Challenge requirements that are technically misleading, especially universal PWA-install detection, sensitive service-worker caching, client/staff authorization, and concurrency around the 10-question daily cap.

Map every non-negotiable invariant in `AGENTS.md` to a concrete design decision and an automated test. Stop after Task 00 and present the blocking decisions that require human approval.
