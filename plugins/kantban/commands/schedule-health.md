---
description: "Set up recurring board health checks via CronCreate"
argument-hint: "Interval (optional, default 4h)"
---

# /schedule-health — Recurring Board Health Checks

Schedule periodic board health checks that automatically detect bottlenecks and surface actionable suggestions.

## Steps

### 1. Resolve project and board context

Read `kanban://my/dashboard` to identify the active project and board. Hold the resolved `projectId` and `boardId`.

### 2. Determine the schedule

**Default cron:** `3 */4 * * *`
- Runs every 4 hours at 3 minutes past the hour (00:03, 04:03, 08:03, …)
- Offset from the hour (:03 rather than :00) to avoid fleet-wide load spikes

**If the user provided an interval argument**, parse it and adjust the cron expression accordingly. Examples:
- "2h" → `3 */2 * * *`
- "6h" → `3 */6 * * *`
- "daily" or "24h" → `3 9 * * *` (once a day at 09:03)
- "hourly" → `3 * * * *`

If the interval is ambiguous or very short (< 1h), confirm with the user before proceeding.

### 3. Create the cron job

Call `CronCreate` with:
- `prompt`: `board-health` (this invokes the board-health prompt, not a single tool)
- `schedule`: the resolved cron expression
- `inputs`:
  - `projectId` — resolved in step 1
  - `boardId` — resolved in step 1

### 4. Confirm and warn about session scope

After creating the cron, confirm:
> "Board health checks scheduled every [interval]. I'll alert you when bottlenecks are detected."

**Always include this warning:**
> "Note: this cron runs in the current terminal session. If you close this terminal, the scheduled job will stop. For persistent scheduling that survives restarts, use Claude Desktop's scheduled tasks feature instead."

## Notes

- Crons are session-scoped — they live only as long as this Claude Code session is running.
- Use `/unschedule` to view or cancel running KantBan crons.
- For standup scheduling, use `/schedule-standup`.
- Keep intervals reasonable — very frequent health checks (< 30 min) add little value and create noise.
