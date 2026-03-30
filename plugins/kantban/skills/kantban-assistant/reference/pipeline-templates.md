# Pipeline Templates Reference

Pipeline templates are reusable multi-step workflows that Claude can run on demand. They encode board creation, column configuration, prompt linking, firing constraints, and workflow rules into a repeatable sequence of tool calls.

---

## What Pipeline Templates Are

A pipeline template is a named sequence of actions that KantBan executes on a board. Each step can create columns, link prompts, set agent configs, configure constraints, and establish workflow rules. Pipeline templates are:

- **Reusable** — run the same pipeline template to scaffold new boards with consistent configuration.
- **Previewable** — always run with `dryRun: true` first to see what will happen.
- **Customizable** — built-in pipeline templates have parameters; user-defined pipeline templates can be arbitrarily complex.

---

## Built-In Pipeline Templates

### `adversarial-pipeline`

Creates a Plan → Build → QA board with sprint contracts, adversarial evaluation, circuit breaking, firing constraints, WIP limits, and dependency gating. Based on Anthropic harness design patterns.

**Parameters:**
- `boardName` (required) — name for the new board
- `spaceId` (optional) — doc space for prompt documents. If omitted, uses the project's first space.

**What it creates (41 steps):**

| Category | What |
|----------|------|
| **Board & columns** | Board with 7 columns: Backlog, Plan, Build, QA, Needs Human, Done |
| **Column types** | Backlog=start, Plan/Build/QA=in_progress, Done=done |
| **Prompt documents** | 3 documents (Plan, Build, QA) linked to their respective columns |
| **Agent configs** | Plan: Opus, concurrency 2, 5 iterations. Build: Opus, concurrency 1, 15 iterations, worktree enabled. QA: Opus, concurrency 1, 5 iterations, worktree enabled |
| **Custom fields** | `review_verdict` (approved/rejected/needs_changes), `quality_score` (0-100) |
| **Transition rules** | Backlog→Plan, Plan→Build, Plan→Backlog, Build→QA, Build→Needs Human, QA→Done, QA→Build, QA→Needs Human |
| **Field requirements** | `review_verdict` required before entering Done |
| **Circuit breaker** | Threshold 3, target: Needs Human column |
| **WIP limits** | Plan: 5, Build: 3, QA: 3 |
| **Dependency requirement** | Build column: blockers must reach Done or be archived |
| **Firing constraints** | 6 constraints across Plan, Build, and QA (see below) |
| **Auto-archive** | Done column archives tickets after 24 hours |

**Firing constraints configured:**

| Column | Constraint | Effect |
|--------|-----------|--------|
| Plan | Build under capacity | Stops planning when Build has 3+ tickets |
| Plan | Circuit breaker clear | Stops planning when Needs Human has tickets |
| Build | QA under capacity | Stops building when QA has 3+ tickets |
| Build | Circuit breaker clear | Stops building when Needs Human has tickets |
| Build | Cooldown 60s | Minimum 60 seconds between Build agent spawns |
| QA | Circuit breaker clear | Stops QA when Needs Human has tickets |

**How the pipeline solves three design problems:**

1. **Concurrent work end state**: Build agents work in isolated git worktrees. Before handing off to QA, the Build agent creates a pull request from the worktree branch. QA evaluates the running code and PR. On approval, the PR is linked to the ticket — it is the merge-ready deliverable. The user's merge strategy determines when and how it lands.

2. **Definition of done**: The QA agent grades against four criteria (Design Quality, Originality, Craft, Functionality) with a hard threshold of >= 70/100. The `review_verdict` field is required before a ticket can enter Done. Ticket dependencies are enforced — blockers must reach Done or be archived before a ticket enters Build. The Plan agent also checks for unresolved dependencies during planning.

3. **Token waste prevention**: Six firing constraints prevent agents from spawning when work cannot proceed. Downstream capacity gates stop Plan from flooding Build and Build from flooding QA. Circuit breaker constraints halt all automation when tickets pile up in Needs Human. A 60-second cooldown on Build prevents rapid re-processing. WIP limits on all pipeline columns cap concurrent work.

**When to suggest it:** User says "set up a pipeline," "create an adversarial board," "I want automated Plan/Build/QA," or describes wanting agents that plan, implement, and evaluate code.

---

## Discovering Available Pipeline Templates

**Tool:** `kantban_list_pipeline_templates`

Returns all pipeline templates available for a given project — both built-in and user-defined. Always call this before suggesting a pipeline template, so you can confirm it's available and check its parameters.

```json
{
  "projectId": "uuid-here"
}
```

---

## Running a Pipeline Template

**Tool:** `kantban_run_pipeline_template`

**Always use `dryRun: true` first.** Show the user what will happen, then confirm before running.

```json
{
  "templateId": "adversarial-pipeline",
  "parameters": {
    "boardName": "My Pipeline Board"
  },
  "dryRun": true
}
```

The dry run returns a list of actions: "Would create board", "Would create 7 columns", "Would create 3 documents", "Would create 6 firing constraints", etc.

Show this to the user. When they confirm, re-run with `dryRun: false`.

---

## User-Defined Pipeline Templates

Users can create custom pipeline templates through the KantBan UI or API. Claude should:

1. Call `kantban_list_pipeline_templates` to discover what's available.
2. Never assume a pipeline template exists — always verify with the list call.
3. If a user mentions a pipeline template by name that isn't in the list, say so and offer to help them create one or find the right built-in.

User-defined pipeline templates appear alongside built-in pipeline templates in the list response. They follow the same `dryRun` preview flow.

Users can also capture an existing board as a template using `kantban_capture_board_template`. This snapshots the board's columns, agent configs, transition rules, field requirements, firing constraints, and prompt documents into a reusable template.

---

## Suggesting Pipeline Templates

Offer a pipeline template when the user's request maps to one:

- "Set up a pipeline board" → suggest `adversarial-pipeline`
- "I want automated Plan/Build/QA" → suggest `adversarial-pipeline`
- "Create an adversarial evaluation board" → suggest `adversarial-pipeline`

How to offer: "I can run the `adversarial-pipeline` template — it'll create a Plan→Build→QA board with worktree isolation, firing constraints, WIP limits, and adversarial QA scoring. Want to preview it first?"

If the user says yes, run with `dryRun: true` and show the plan.

---

## Recipe: Risk-Proportional Routing

Route tickets through different pipeline paths based on complexity. Uses existing primitives — no new code needed.

### Setup

1. **Create a `complexity` field** (type: `single_select`, options: `trivial`, `standard`, `complex`)
2. **Set complexity early** — first pipeline column's prompt instructs the agent to classify and set `complexity`
3. **Create firing constraints** that gate columns based on complexity:
   - Trivial tickets skip heavy QA: `ticket.field_value` constraint on QA column, `complexity != trivial`
   - Complex tickets route through Architecture Review: `ticket.field_value` constraint, `complexity == complex`
4. **Set model routing per complexity** — trivial columns use `model_routing.initial: "haiku"` with empty escalation

### Template Steps

```json
[
  { "tool": "create_field", "params": { "name": "complexity", "type": "single_select", "config": { "options": ["trivial", "standard", "complex"] } } },
  { "tool": "create_firing_constraint", "params": { "columnId": "{{qaColumnId}}", "name": "skip-trivial", "subjectType": "ticket.field_value", "subjectRef": "complexity", "operator": "!=", "value": "trivial", "scope": "column" } },
  { "tool": "create_firing_constraint", "params": { "columnId": "{{archReviewColumnId}}", "name": "complex-only", "subjectType": "ticket.field_value", "subjectRef": "complexity", "operator": "==", "value": "complex", "scope": "column" } }
]
```

---

## Recipe: Verify-Fix Cycle

Optional post-completion verification that creates targeted fix tickets on failure. Uses existing primitives.

### Setup

1. **Add a Verify column** after the Done column (type: `in_progress`, has prompt document)
2. **Prompt document** instructs the agent to check integrated codebase: full build, no regressions, interfaces align
3. **On failure**: agent creates a fix ticket with `blocks` link to the original
4. **Dependency requirement** on Verify column prevents original from advancing until fix resolves

### Template Steps

```json
[
  { "tool": "create_column", "params": { "name": "Verify", "column_type": "in_progress", "position": 5 } },
  { "tool": "create_document", "params": { "title": "Verify Prompt", "content": "# Verification\n\nCheck the integrated codebase...", "spaceId": "{{spaceId}}" } },
  { "tool": "link_prompt_document", "params": { "columnId": "{{verifyColumnId}}", "documentId": "{{verifyPromptId}}" } },
  { "tool": "set_dependency_requirement", "params": { "boardId": "{{boardId}}", "toColumnId": "{{verifyColumnId}}", "resolved_when": { "link_type": "blocks", "resolution": "resolved" } } }
]
```

---

## Scheduling Pipeline Templates

Pipeline templates can be scheduled to run automatically on a cron schedule using the `/schedule-template` command.

**How it works:**
1. User invokes `/schedule-template` with an optional pipeline template name and schedule.
2. Claude discovers available pipeline templates and collects parameters.
3. A `CronCreate` job is created that invokes the `run-pipeline-template` MCP prompt on the specified schedule.
4. Each cron invocation runs the pipeline template with the pre-configured parameters.

**Important notes:**
- Scheduled runs execute live (not dry-run) since the user confirmed parameters at scheduling time.
- Use `/unschedule` to view or cancel scheduled pipeline templates in the current session.

**Session lifetime:** These crons are in-session timers — they only fire while the terminal is open. When the terminal closes, they're gone with no catch-up. Users must re-schedule each session. For persistent automation, direct users to **Claude Desktop's scheduled tasks** and the "Desktop Scheduled Task Recipes" in the plugin README.

**When to suggest scheduling:**
When a user runs a pipeline template manually and the workflow is inherently recurring, offer: "Want me to schedule this pipeline template to run automatically? Use `/schedule-template`."
