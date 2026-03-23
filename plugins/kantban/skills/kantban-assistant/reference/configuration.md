# Configuration Reference

KantBan assistant behavior can be tuned via the user's `CLAUDE.md` file and environment variables. Settings in `CLAUDE.md` override skill defaults. Environment variables override `CLAUDE.md`.

---

## CLAUDE.md Configuration

Add a `## KantBan Plugin Configuration` section to the user's `CLAUDE.md` to override defaults.

```markdown
## KantBan Plugin Configuration

### Nudge Behavior
- `kantban.nudge: false` — Disable work-tracking suggestions entirely
- `kantban.nudge_frequency: "session"` — Only suggest at session end (default: "natural" = at breakpoints)

### Session Behavior
- `kantban.auto_standup: true` — Run standup report on session start
- `kantban.session_context: false` — Disable SessionStart board summary

### Defaults
- `kantban.default_project: "<uuid>"` — Skip project selection prompt
- `kantban.default_board: "<uuid>"` — Skip board selection prompt

### Planning
- `kantban.planning_style: "minimal"` — Shorter ticket descriptions (default: "detailed")
- `kantban.dry_run_default: false` — Skip plan preview and create immediately (default: true)
```

---

## Configuration Options Reference

### Nudge Behavior

**`kantban.nudge`** (boolean, default: `true`)
- `true` — Claude will offer to track work items that appear to map to a ticket.
- `false` — All nudges are silenced. Claude will never mention the board unless asked.

**`kantban.nudge_frequency`** (string, default: `"natural"`)
- `"natural"` — Claude nudges at natural breakpoints: after a task completes, when switching topics.
- `"session"` — Claude only offers a board update at the end of a session.
- `"never"` — Alias for `kantban.nudge: false`.

---

### Session Behavior

**`kantban.auto_standup`** (boolean, default: `false`)
- `true` — On session start, Claude automatically reads the board and generates a standup summary: what was done yesterday, what's in progress, any blockers.
- `false` — Standup only runs when the user asks or triggers `/schedule-standup`.

**`kantban.session_context`** (boolean, default: `true`)
- `true` — On session start, Claude reads `kanban://my/dashboard` and silently loads board context.
- `false` — Claude does not pre-load board context. Board state is only read when the user mentions it.

Use `kantban.session_context: false` for users who rarely use the board in most sessions — it reduces unnecessary resource reads.

---

### Defaults

**`kantban.default_project`** (UUID string, default: unset)
- When set, Claude uses this project ID without prompting the user to choose.
- Useful for solo users with one primary project.

**`kantban.default_board`** (UUID string, default: unset)
- When set, Claude uses this board ID without prompting the user to choose.
- Takes precedence for all board-scoped operations.

---

### Planning

**`kantban.planning_style`** (string, default: `"detailed"`)
- `"detailed"` — Ticket bodies include context, acceptance criteria, and implementation notes.
- `"minimal"` — Ticket bodies include only acceptance criteria. Shorter, faster to create.

**`kantban.dry_run_default`** (boolean, default: `true`)
- `true` — `kantban_plan_to_tickets` always previews before creating. User must confirm.
- `false` — Skip the preview step and create tickets immediately. Use only if the user explicitly prefers this flow.

---

## Environment Variables

Environment variables take precedence over `CLAUDE.md` settings.

| Variable | Equivalent Setting | Description |
|---|---|---|
| `KANTBAN_SESSION_CONTEXT` | `kantban.session_context` | `"false"` disables session start board load |
| `KANTBAN_AUTO_STANDUP` | `kantban.auto_standup` | `"true"` enables standup on session start |
| `KANTBAN_DEFAULT_PROJECT` | `kantban.default_project` | Default project UUID |
| `KANTBAN_DEFAULT_BOARD` | `kantban.default_board` | Default board UUID |

Environment variables are useful for CI/CD contexts or shared team configurations where CLAUDE.md may not be user-specific.

---

## Reading Configuration in Practice

When activating, Claude should:
1. Check if `CLAUDE.md` contains a `## KantBan Plugin Configuration` section.
2. Apply any overrides found.
3. Check env vars and apply on top.
4. Use the merged result as the active configuration.

If a user explicitly asks "why isn't Claude nudging me?" or "why does the standup run automatically?" — the answer is usually in their `CLAUDE.md` or environment. Check there first.
