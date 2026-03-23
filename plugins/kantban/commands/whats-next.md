---
description: "Get a prioritized recommendation for what to work on next"
---

# /whats-next — Next Task Recommendation

Get a prioritized recommendation for what to pick up next, based on your current board state and in-progress work.

## Steps

### 1. Resolve project context

Determine the active `projectId`. If a default is configured in CLAUDE.md (`kantban.default_project`), use it. Otherwise, read `kanban://my/dashboard` and ask the user to pick a project.

### 2. Read next-tasks resource

```
Read resource: kanban://project/{projectId}/my-next-tasks
```

This resource returns a ranked list of recommended tasks, taking into account:
- WIP limits and columns with capacity
- Tickets blocked on your in-progress work
- Priority and age of backlog items
- Any explicitly assigned tickets

### 3. Present the top recommendation

Surface the first recommendation clearly:

```
Recommended next task:

[Column] Ticket title
Board: Sprint 3

Why this: <reason from resource>

Acceptance criteria:
- <criterion 1>
- <criterion 2>
```

If the resource returns multiple candidates, list them briefly after the top pick:

```
Other options:
2. [To Do] ...
3. [Backlog] ...
```

### 4. Offer to start working on it

Ask:
> "Want me to move this to In Progress and set it as your active task?"

If yes, call `kantban_start_working_on` with the ticket's `ticketId` and `projectId`.

If no, offer to show the next candidate or do nothing.

## Notes

This is a read-present-offer flow — do not invoke an MCP prompt. Keep it fast and focused on getting the user to their next action in as few steps as possible.
