---
description: "List and cancel KantBan-related scheduled jobs"
---

# /unschedule — Cancel Scheduled KantBan Jobs

List all active scheduled jobs and cancel any KantBan-related ones.

## Steps

### 1. List all active crons

Call `CronList` to retrieve all currently scheduled jobs in this session.

### 2. Filter to KantBan-related jobs

From the results, identify jobs that are KantBan-related. A job is KantBan-related if it meets any of these criteria:
- The prompt or tool name starts with `kantban_` or `daily-standup` or `board-analyst`
- The inputs include a `projectId` or `boardId` field
- The description references KantBan, kanban, standup, or board health

### 3. Present the filtered list

If KantBan-related jobs exist, display them clearly:

```
Active KantBan scheduled jobs:

1. Daily Standup
   Schedule: 57 8 * * 1-5 (weekdays at 08:57)
   Project: My Project / Sprint 3
   ID: <cron-id>

2. Board Health Check
   Schedule: 3 */4 * * * (every 4 hours)
   Project: My Project / Sprint 3
   ID: <cron-id>
```

If no KantBan-related jobs are found:
> "No active KantBan scheduled jobs found in this session."

### 4. Offer cancellation

Ask the user which jobs to cancel:
> "Which job(s) would you like to cancel? (Enter a number, 'all', or 'none')"

For each job the user selects, call `CronDelete` with the corresponding cron ID.

Confirm each deletion:
> "Cancelled: Daily Standup."

### 5. Summarise

After all selected jobs are deleted, summarise:
> "Done. [N] job(s) cancelled. [M] job(s) still running."

Or if nothing was cancelled:
> "No changes made."

## Notes

- Only jobs in the current session are listed — crons from previous sessions are not recoverable.
- To reschedule after cancelling, use `/schedule-standup` or `/schedule-health`.
- Non-KantBan crons in the session are shown in the raw `CronList` output but are not acted on unless the user explicitly requests it.
