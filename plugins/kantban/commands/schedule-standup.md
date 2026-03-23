---
description: "Set up a recurring daily standup report via CronCreate"
argument-hint: "Time (optional, default 9am)"
---

# /schedule-standup — Recurring Daily Standup

Schedule a daily standup report that summarises yesterday's completions, today's plan, and any blockers.

## Steps

### 1. Resolve project context

Read `kanban://my/dashboard` to identify the active project and board. Hold the resolved `projectId` and `boardId`.

### 2. Determine the schedule

**Default cron:** `57 8 * * 1-5`
- Runs weekdays (Mon–Fri) at 08:57 AM
- Offset from the hour (:57 rather than :00) to avoid fleet-wide load spikes when many users schedule at the same time

**If the user provided a time argument**, parse it and adjust the cron expression accordingly. Examples:
- "8am" → `57 7 * * 1-5` (offset 3 min before)
- "9:30am" → `27 9 * * 1-5`
- "10am weekdays" → `57 9 * * 1-5`

If the time is ambiguous, confirm with the user before creating the cron.

### 3. Create the cron job

Call `CronCreate` with:
- `prompt`: the `daily-standup` MCP prompt
- `schedule`: the resolved cron expression
- `inputs`:
  - `projectId` — resolved in step 1
  - `boardId` — resolved in step 1

### 4. Confirm and warn about session scope

After creating the cron, confirm:
> "Standup scheduled for weekdays at [time]. I'll post a summary each morning."

**Always include this warning:**
> "Note: this cron runs in the current terminal session. If you close this terminal, the scheduled job will stop. For persistent scheduling that survives restarts, use Claude Desktop's scheduled tasks feature instead."

## Notes

- Crons are session-scoped — they live only as long as this Claude Code session is running.
- Use `/unschedule` to cancel this or any other KantBan cron.
- For health check scheduling, use `/schedule-health`.
