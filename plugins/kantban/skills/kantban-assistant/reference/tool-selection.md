# Tool Selection Reference

Decision trees for the most common scenarios. Always start at the top of each tree and stop when you find a match.

---

## "User asks about board state"

```
Is the question high-level ("what's going on with the project")?
  → Read kanban://my/dashboard or kanban://project/{id}/board/{id}/snapshot
  → Do NOT call any tools

Is the question about a specific board?
  → Read kanban://project/{projectId}/board/{boardId}/snapshot
  → If more detail is needed on a single ticket: kantban_get_ticket_context

Is the question about recent activity?
  → Read kanban://project/{projectId}/recent-activity
  → If user wants a structured summary: kantban_get_project_dashboard

Is the question about a specific ticket by ID or title?
  → kantban_get_ticket or kantban_search_tickets
  → If user needs full context (comments, fields, linked docs): kantban_get_ticket_context
```

---

## "User says build X" (planning)

```
Does the user have a concrete feature description?
  → Brief clarifying conversation if scope is unclear (max 2-3 questions)
  → Decompose into 1-2 hour tickets mentally
  → kantban_plan_to_tickets with dryRun: true  ← ALWAYS preview first
  → Show user the proposed tickets
  → Adjust based on feedback
  → kantban_plan_to_tickets with dryRun: false

Is this a multi-phase project?
  → Plan phase 1 tickets only
  → Note future phases in the phase 1 tickets or a linked document
  → Avoid creating tickets for work more than ~2 weeks out

Does the user just want one ticket created?
  → kantban_create_ticket (not plan_to_tickets)
```

---

## "User asks what they should do"

```
Read kanban://project/{projectId}/my-next-tasks first
  → Does it have a clear top recommendation?
    → Yes: present it with a brief justification
    → No (empty or unclear): call kantban_suggest_next_task

User picks a task:
  → kantban_start_working_on
  → Summarize the ticket context in 1-2 sentences
  → Begin work

User wants more options:
  → kantban_suggest_next_task (returns ranked list)
  → Present top 3 with justifications
```

---

## "User is coding and hasn't mentioned the board"

```
Can you infer what ticket this maps to from context?
  → Yes: check kantban_detect_current_ticket (uses branch name)
    → Match found: nudge ONCE — "I notice you might be working on PROJ-18. Want me to track this?"
      → User says yes: kantban_start_working_on
      → User says no/ignores: do not ask again this session for that ticket
    → No match: consider whether to ask "Is there a ticket for this?"
      → Only ask if work is non-trivial and user seems to be starting something new
      → Don't interrupt if user is clearly in flow

Did user already decline a nudge this session?
  → Do not ask again. Do not create a ticket without asking.
```

---

## "User asks about bottlenecks or board health"

```
Read kanban://project/{projectId}/health first
  → Is the health summary sufficient?
    → Yes: share it with brief commentary
    → No (user wants details or the health signal shows problems): kantban_detect_bottlenecks
      → Returns column-level flow analysis
      → If the analysis is complex: describe findings and offer recommendations

Does the user want a deep analysis?
  → kantban_detect_bottlenecks
  → kantban_get_velocity (trend data)
  → kantban_retrospective_insights (pattern analysis)
  → Synthesize into a clear summary — don't dump raw data
```

---

## "User mentions a PR, branch, or commit"

```
Is there a current git context (branch name known)?
  → kantban_detect_current_ticket
    → Match found: load ticket with kantban_get_ticket_context
    → No match: ask if there's a ticket for this work

User mentions a specific PR number:
  → kantban_link_github_reference (type: "pr", reference: "owner/repo#123")
    → Link to the relevant ticket

User wants to refresh PR status (CI, merge state):
  → kantban_sync_github_references

User wants to see all linked references for a ticket:
  → kantban_list_github_references
```

---

## "User wants to schedule something"

```
What are they scheduling?
  → Daily standup: CronCreate with "57 8 * * 1-5"
  → Board health check: CronCreate with "3 */4 * * *"
  → Backlog grooming: CronCreate with "3 14 * * 1-5"
  → Custom: ask for frequency, calculate a non-:00/:30 minute offset

After creating the cron, confirm with:
  → CronList (to show the user what's now scheduled)

User wants to cancel a scheduled task:
  → CronList to find the job ID
  → CronDelete with the ID

IMPORTANT: Session-scoped crons die when the terminal closes. Mention this
if the user expects the schedule to persist across sessions.
```

---

## Batch vs. Single Tools

**Always batch when operating on multiple items:**

| Scenario | Wrong | Right |
|---|---|---|
| Creating 5 tickets | Loop: `kantban_create_ticket` × 5 | `kantban_create_tickets` (array) |
| Moving 3 tickets to Done | Loop: `kantban_move_ticket` × 3 | `kantban_move_tickets` (array) |
| Updating priority on 4 tickets | Loop: `kantban_update_ticket` × 4 | `kantban_update_tickets` (array) |
| Archiving a sprint's tickets | Loop: `kantban_archive_ticket` × N | `kantban_archive_column_tickets` |
| Adding comments to 3 tickets | Loop: `kantban_create_comment` × 3 | `kantban_create_comments` (array) |

Single-item tools are correct when operating on exactly one item. If you find yourself writing a loop over single-item calls, stop and use the batch equivalent.

---

## Search vs. List

**Use `kantban_search` when:**
- You don't know which board or column the item is in.
- You're looking for something by text content or keyword.
- Cross-entity search is needed (tickets + documents + comments).

**Use `kantban_list_tickets` when:**
- You know the board and want all tickets (or want to filter by column/status).
- You're iterating over a known set.

**Use `kantban_search_tickets` when:**
- You want ticket-specific filtering (status, assignee, labels, date range).
- You know the board context.

**Use `kantban_search_documents_chunked` when:**
- Searching large document collections.
- A document is too large to read in full — fetch the relevant chunks only.
