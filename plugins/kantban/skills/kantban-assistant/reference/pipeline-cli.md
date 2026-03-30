# Pipeline CLI Reference

The KantBan CLI (`kantban-cli`) runs a pipeline orchestrator that spawns Claude Code agents (`claude -p`) to process tickets on pipeline columns. Firing constraints are enforced before any agent is spawned.

---

## Installation

```bash
npm install -g kantban-cli
```

Or run without installing:

```bash
npx kantban-cli pipeline <board-id> [flags]
```

Published on npm as **`kantban-cli`**. Requires Node.js 22+.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `KANTBAN_API_URL` | Yes | API base URL (e.g. `https://api.kantban.app` or `http://localhost:3000`) |
| `KANTBAN_API_TOKEN` | Yes | API token starting with `cb_` — generate from account settings |
| `KANTBAN_PROJECT_ID` | No | Explicit project ID. If omitted, auto-resolved from the board |

---

## Pipeline Command

```bash
kantban pipeline <board-id> [flags]
```

### Flags

| Flag | Default | Description |
|---|---|---|
| `--once` | off | Run one scan cycle, wait for all loops to complete, then exit |
| `--dry-run` | off | Print configuration summary without starting agents |
| `--column <id>` | all | Filter to a single column by ID |
| `--max-iterations <n>` | per-column | Override `agentConfig.max_iterations` for all columns |
| `--max-budget <usd>` | per-column | Override `agentConfig.max_budget_usd` for all columns |
| `--model <model>` | per-column | Override `agentConfig.model_preference` for all columns |
| `--concurrency <n>` | per-column | Override `agentConfig.concurrency` for all columns |
| `--log-retention <days>` | 7 | Days to keep log files |
| `--yes`, `-y` | off | Skip safety confirmation prompt |

CLI flags take precedence over per-column `agentConfig` values.

### Stop Command

```bash
kantban pipeline stop <board-id>
```

Sends SIGTERM to a running persistent pipeline and its child `claude -p` processes.

---

## Pipeline Design Considerations

Before configuring the orchestrator, three design problems need answers. The pipeline provides tools for each — the choice of how to use them belongs to the user.

### 1. Concurrent Work Strategy

The pipeline can spawn multiple Claude agents working on different tickets simultaneously. Each agent produces code changes. The question is: **where do those changes land, how do they move through the pipeline, and what is their end state?**

Relevant capabilities:

- **Worktrees** (`agentConfig.worktree`) — Each agent gets an isolated git worktree, so concurrent agents don't conflict. Changes live in separate directories. Lifecycle fields (`on_move`, `on_done`) define what happens to the worktree at each pipeline transition. `integration_branch` defines which branch agents merge before starting work — the prompt composer automatically injects merge instructions when this is set.
- **Branching** — Without worktrees, agents work in the same checkout. The user decides whether agents create branches, commit to a shared branch, or something else. The prompt document controls this behavior.
- **Column progression** — Agents can move tickets between columns. The prompt document defines when and why a ticket should move.
- **Transition rules** — Gate which column-to-column moves are allowed, enforcing a defined flow.

**If the user does nothing:** concurrent agents write to the same working directory (risking conflicts), changes sit in whatever branches agents create, and there is no defined path from "agent finished" to "code is merged/deployed." The prompt documents and column design must address this.

**Branch freshness:** When agents work in worktrees, their branches diverge from main as other PRs land. Configure `worktree.integration_branch` to set which branch agents merge before starting work — the prompt composer injects merge instructions automatically. Stale branches waste entire Build+QA cycles when conflicts surface late. **Never rebase** — rebase rewrites history and destroys traceability across the pipeline. Always merge.

Questions to surface:
- Do agents work in worktrees or a shared checkout?
- Does each ticket get its own branch? Who creates it — the agent, the user, or a pipeline step?
- How do agents stay current with main? When do they pull in changes from other merged PRs?
- What happens when an agent finishes? Does the ticket move to a review column? Does a PR get created?
- How do changes from multiple agents converge into a deployable state?

### 2. Definition of Done and Dependency Management

The pipeline moves tickets through columns, but it needs to know when work is complete and how tickets relate to each other.

Relevant capabilities:

- **Transition field requirements** — Require specific custom field values before a ticket can enter a column (e.g., "test_status must be 'passing' before entering Done").
- **Ticket links and blockers** — Tickets can have `blocks`/`blocked_by` relationships. The orchestrator checks these before spawning — blocked tickets are deferred until their blockers resolve.
- **Dependency requirements** — Configure what "resolved" means for a blocker (e.g., the blocking ticket must reach a `done`-type column).
- **Gutter detection** — The orchestrator detects when an agent makes no progress and stops the loop, preventing infinite iteration on tickets that can't be completed.
- **Column types** — Columns have types (`start`, `in_progress`, `done`, `default`) that inform the orchestrator's behavior and blocker resolution.

**If the user does nothing:** the pipeline processes tickets in whatever order they appear, agents iterate up to `max_iterations` regardless of actual completion, there is no validation that work meets any standard before advancing, and dependencies between tickets are ignored.

Questions to surface:
- What custom fields define "done" for a ticket? Are there required fields before a ticket can advance?
- Do tickets have dependencies? Should the pipeline respect blocking relationships?
- How does an agent know when to stop working and move the ticket forward?
- Is there a review or validation step between columns?

### 3. Preventing Token Waste

Each `claude -p` invocation consumes tokens. Without constraints, the pipeline fires agents on every scan cycle for every ticket in every pipeline column — even when work cannot proceed.

Relevant capabilities:

- **Firing constraints** — Declarative rules evaluated before any agent is spawned. If any enabled constraint on a column fails, no agent fires. See [firing-constraints.md](firing-constraints.md) for subject types, operators, and patterns.
- **Constraint subjects** — Measure column ticket counts, WIP capacity, active loop counts, time of day, circuit breaker state, backlog size, cooldown timers, and custom field values.
- **Circuit breaker** — A board-level emergency stop. When tickets pile up in a designated column (e.g., "Needs Human Review"), constraints can halt all automation until the column is cleared.
- **Notify flag** — Constraints can create signals when they block, so the user knows automation is paused and why.

**If the user does nothing:** Claude fires on every eligible ticket every scan cycle. An agent that finds nothing to do still consumes tokens writing signals and comments to report that fact. A column with 10 tickets and no work to do burns 10 agent invocations every 30 seconds. Firing constraints exist specifically to prevent this — they stop Claude from being spawned when the conditions for productive work aren't met.

Questions to surface:
- Should columns respect WIP limits or downstream capacity before firing?
- Is there a cooldown between fires to prevent rapid re-processing?
- Should automation pause during off-hours or when human review is backed up?
- What conditions indicate there is genuinely nothing for an agent to do?

---

## Column Configuration

A column becomes a pipeline column when it has a linked prompt document and its type is not `done`. The orchestrator uses three column-level fields to control agent behavior.

### promptDocumentId

The document whose content becomes the system prompt for `claude -p`. Create a document first, then link it:

```
kantban_create_document(projectId, spaceId, title: "Design Review Prompt", content: "...")
  → returns document ID

kantban_update_column(projectId, columnId, promptDocumentId: "<document-id>")
```

A column without `promptDocumentId` is not a pipeline column and will never spawn agents.

### goal

Free-text guidance injected into the agent's prompt alongside the document content. Use for column-specific instructions that don't warrant a full document.

```
kantban_update_column(projectId, columnId, goal: "Focus on code review and test coverage")
```

`goal` is optional. Set to `null` to clear.

### agentConfig

A JSON object on the column that controls execution behavior. All fields are optional — unset fields use orchestrator defaults.

```
kantban_update_column(projectId, columnId, agentConfig: { ... })
```

| Field | Type | Default | Description |
|---|---|---|---|
| `execution_mode` | `"kant_loop"` \| `"cron_poll"` \| `"manual"` | `"kant_loop"` | How the column processes tickets |
| `concurrency` | positive integer | `1` | Max simultaneous agent loops per column |
| `max_iterations` | positive integer | `10` | Max Claude invocations per ticket before stopping |
| `max_budget_usd` | positive number \| null | `null` (unlimited) | Per-ticket USD budget cap. Converted to `--max-turns` via `ceil(value × 10)` (e.g. $1.00 = 10 turns) |
| `gutter_threshold` | positive integer | `3` | Consecutive iterations with no progress before declaring stalled |
| `model_preference` | string | none (Claude default) | Model ID passed to `claude -p --model` (e.g. `"claude-sonnet-4-6"`) |
| `poll_interval_seconds` | positive integer | — | Interval for `cron_poll` execution mode |
| `worktree.enabled` | boolean | `false` | Spawn each agent in an isolated git worktree |
| `worktree.on_move` | `"keep"` \| `"merge"` \| `"cleanup"` | — | What happens to the worktree when a ticket moves between columns |
| `worktree.on_done` | `"pr"` \| `"merge"` \| `"cleanup"` | — | What happens to the worktree when the loop terminates |
| `worktree.integration_branch` | string | `"main"` | Branch agents merge before starting work. Injected into prompt automatically |
| `worktree.path_pattern` | string | — | *(legacy — still accepted, ignored by orchestrator. Use semantic fields instead)* |
| `allowed_tools` | string[] | — | Whitelist: only these tools available to the column's agent |
| `disallowed_tools` | string[] | — | Blacklist: these tools blocked from the column's agent |
| `builtin_tools` | string | — | Claude built-in tools (space-separated). `""` = strip all built-in tools. Omit for all defaults |
| `invocation_tier` | `"auto"` \| `"light"` \| `"heavy"` | `"auto"` | Force tier. Auto = light if no prompt doc, heavy otherwise |
| `lookahead_column_id` | column UUID | — | Downstream column whose prompt doc is injected as acceptance criteria |
| `run_memory` | boolean | `false` | Enable cross-agent knowledge persistence for this column |
| `advisor.enabled` | boolean | `false` | Enable post-failure advisor recovery |
| `advisor.max_invocations` | positive integer | `2` | Max advisor calls per ticket before escalation |
| `checkpoint` | boolean | `false` | Enable loop state persistence for crash recovery |
| `model_routing.initial` | string | — | Starting model for the column |
| `model_routing.escalation` | string[] | — | Model ladder for stuck escalation |
| `model_routing.escalate_after` | positive integer | `2` | Advisor RETRY_DIFFERENT_MODEL calls before next model |
| `stuck_detection.enabled` | boolean | — | Enable periodic trajectory classification |
| `stuck_detection.first_check` | positive integer | `3` | First iteration to check |
| `stuck_detection.interval` | positive integer | `2` | Check every N iterations after first_check |

Set `agentConfig` to `null` to clear all overrides and use orchestrator defaults.

### Tool Restrictions

Control which tools are available to a column's pipeline agent. Three fields work together:

- **`allowed_tools`** — Whitelist. Only these tools (MCP + built-in) are available. If set, overrides the default full toolset.
- **`disallowed_tools`** — Blacklist. These specific tools are blocked. Applied on top of the allowed set.
- **`builtin_tools`** — Controls Claude's built-in tools via the `--tools` CLI flag. Space-separated tool names. Set to `""` (empty string) to strip all built-in tools. Omit entirely for full defaults.

**No restrictions (default):** If none of the three fields are set, the agent has access to all tools — both Claude built-ins and all MCP tools. This is the default behavior when tool restriction fields are absent.

**Examples:**

Read-only reviewer (no file modification tools):
```
agentConfig: {
  disallowed_tools: ["Edit", "Write", "Bash"],
}
```

MCP-only agent (strip built-in tools, keep KantBan MCP):
```
agentConfig: {
  builtin_tools: "",
}
```

Targeted whitelist:
```
agentConfig: {
  allowed_tools: ["Read", "Glob", "Grep", "mcp__kantban__kantban_move_ticket", "mcp__kantban__kantban_create_comment"],
}
```

Tool restrictions are also configurable via the column settings UI (Board Settings → Pipeline tab → column) and the `kantban_set_tool_restrictions` / `kantban_get_tool_restrictions` MCP tools.

---

## Board Configuration

### Circuit Breaker

A board-level safety mechanism. When configured, the `board.circuit_breaker_count` firing constraint subject reads from the target column's ticket count.

```
kantban_update_board(projectId, boardId,
  circuitBreakerThreshold: 5,
  circuitBreakerTargetId: "<escalation-column-id>"
)
```

| Field | Type | Description |
|---|---|---|
| `circuitBreakerThreshold` | positive integer \| null | Threshold count (informational — constraints enforce the actual gate) |
| `circuitBreakerTargetId` | column UUID \| null | Column whose ticket count is exposed as `board.circuit_breaker_count` |

To use this with firing constraints, create a constraint like:

```
subject_type: board.circuit_breaker_count
operator: lt
value: 5
```

This blocks all pipeline columns when the circuit breaker target column reaches 5 tickets.

---

## Firing Constraints Integration

The orchestrator evaluates firing constraints at every spawn point:

1. **Scan cycle** — Before processing a column's tickets. If blocked, the entire column is skipped.
2. **Event-driven spawn** — When a ticket moves into a pipeline column via WebSocket.
3. **Queue drain** — When a loop completes and queued tickets are ready to spawn.
4. **Per-ticket spawn** — Belt-and-suspenders check in every spawn code path.

### Orchestrator-only subject resolution

These subjects resolve differently in the orchestrator vs the API evaluate endpoint:

| Subject | API evaluate | Orchestrator |
|---|---|---|
| `column.active_loops` | Always 0 | Live count from in-memory tracking |
| `column.last_fired_at` | Always 0 (blocks most constraints) | Seconds since last spawn, 999999 if never fired this session |
| `board.total_active_loops` | Always 0 | Sum of all active loops across all columns |
| `ticket.field_value` | Error (fail-open) | Resolved from ticket context |

Use `kantban_evaluate_firing_constraints` for a dry-run preview. The orchestrator uses live runtime state for the actual decision.

### Constraint blocking output

When a constraint blocks, the orchestrator logs:

```
[blocked] Column "Design" (abc123): constraint "Next col under 5" FAILED — resolved=7 lt 5
[scan] Column abc123 (Design): BLOCKED by firing constraints — skipping 3 ticket(s)
```

When a constraint has `notify: true` and blocks, a signal is created on the column.

### Constraint cache refresh

Constraints are cached in memory and refreshed:
- Every 30 seconds during the scan cycle (full column scope re-fetch)
- Immediately on `firing_constraint:created/updated/deleted` WebSocket events

---

## Execution Modes

### `kant_loop` (default)

The orchestrator runs a multi-iteration loop per ticket:
1. Fetch ticket and column context
2. Compose prompt from prompt document + goal + context
3. Invoke `claude -p` with MCP tools available
4. Check for progress via fingerprint diff (comments, field values, column change)
5. If no progress for `gutter_threshold` consecutive iterations → stall and stop
6. If ticket moves to a different column → success, stop
7. Repeat up to `max_iterations`

### `cron_poll`

Single-pass processing on a timer. Each ticket gets one Claude invocation per interval. Configured via `poll_interval_seconds`.

### `manual`

Column is recognized as a pipeline column but the orchestrator does not auto-spawn. Agents are started via the `kantban work` CLI command for interactive single-ticket processing.

---

## Concurrency and Queuing

Each pipeline column has a concurrency limit (default: 1). When a column has more tickets than its concurrency allows:

- Tickets up to the concurrency limit spawn immediately
- Excess tickets enter a per-column FIFO queue
- When a running loop completes, the next queued ticket spawns (if constraints pass)
- Queue state is in-memory — lost on orchestrator restart

---

## Blocker Handling

Before spawning, the orchestrator checks if a ticket has unresolved dependency blockers (ticket links with `blocks` relationship where the blocking ticket hasn't reached a `done` column).

- If blocked → ticket is **deferred** (not queued, not spawned)
- Deferred tickets are re-evaluated every scan cycle and on `ticket:moved` events
- If the blocker check API call fails → ticket is deferred (fail-safe)

---

## Gutter Detection

The orchestrator detects when a Claude agent makes no meaningful progress:

- After each `claude -p` invocation, a fingerprint is captured (comment count, field value count, column)
- If the fingerprint matches the previous iteration → gutter count increments
- When gutter count reaches `gutter_threshold` → loop stops with reason `stalled`
- A signal is created on the ticket so future agents know about the stall

### Stuck Detection (Phase 3)

Pattern-based trajectory classification using a Haiku-class light call. Catches agents that are actively spinning (creating comments and changes that don't advance work) — something fingerprint-only gutter detection misses.

```json
{
  "agent_config": {
    "stuck_detection": {
      "enabled": true,
      "first_check": 3,
      "interval": 2
    }
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | (required) | Enable/disable stuck detection |
| `first_check` | 3 | First iteration to check |
| `interval` | 2 | Check every N iterations after first_check |

**Actions per classification:**

| Status | Action |
|--------|--------|
| `progressing` | Reset gutter counter |
| `spinning` | Increment gutter by 2 (accelerate toward stall). Advisor invoked if enabled. |
| `blocked` | Immediate stall exit. Advisor invoked if enabled. |

**Cost:** ~500 tokens per check (Haiku reading 3 short comments + JSON output). Catching a spinning agent 2 iterations early saves 20K-100K+ tokens.

---

## Progress Detection (Fingerprinting)

The orchestrator tracks ticket state via fingerprints:

| Fingerprint field | Counts as progress |
|---|---|
| `column_id` change | Yes — ticket moved (loop exits with `moved`) |
| `comment_count` change | Yes — agent wrote a comment |
| `field_value_count` change | Yes — agent set a field value |
| `signal_count` change | No — excluded to avoid false progress from dependency signals |

---

## MCP Configuration

The orchestrator generates a stable MCP config file per board:

```
~/.kantban/pipelines/<board-id>/mcp-config.json
```

This config is passed to every `claude -p` invocation via `--mcp-config`. It connects the spawned agent to the KantBan MCP server with the same API token.

---

## Logs

Pipeline logs are stored at:

```
~/.kantban/pipelines/<board-id>/logs/
```

Each run creates a timestamped log file. Use `--log-retention <days>` to control cleanup (default: 7 days).

---

## Orchestrator Lifecycle

```
initialize()
  → Fetch board scope (columns, circuit breaker config, ticket counts)
  → Identify pipeline columns (has_prompt=true AND type != done)
  → Fetch column scope for each (agent config, constraints, tickets)

scanAndSpawn() [every 30 seconds]
  → Refresh board scope
  → Re-evaluate deferred tickets (blockers may have resolved)
  → For each pipeline column:
      → Refresh column scope
      → Evaluate column-scope firing constraints
      → If BLOCKED: skip column, log which constraints failed
      → If PASSED: for each ticket → spawnOrQueue()

spawnOrQueue(ticketId, columnId)
  → Re-check firing constraints
  → If under concurrency limit and no unresolved blockers: spawn
  → If at concurrency limit: add to FIFO queue
  → If blocked by dependencies: defer

onLoopComplete(ticketId, result)
  → Remove from active tracking
  → Drain queue (spawn next queued ticket if constraints pass)
  → Write completion comment on ticket
  → Create signal on ticket for stalled/error exits
```

---

## WebSocket Events

The orchestrator connects to the board's WebSocket channel for real-time events:

| Event | Orchestrator behavior |
|---|---|
| `ticket:created` | Evaluate constraints, spawn if column passes |
| `ticket:moved` | Evaluate constraints, spawn if target is pipeline column; re-evaluate all deferred tickets |
| `ticket:updated` | Re-evaluate if ticket was deferred |
| `ticket:deleted` / `ticket:archived` | Clean up tracking state, remove from queues |
| `firing_constraint:created/updated/deleted` | Refresh all column constraint caches immediately |

Falls back to 30-second polling if WebSocket disconnects.

---

## Three-Loop Architecture

**Inner loop (Ralph Loop):** One ticket, one column. Iterates Claude Code invocations until the ticket moves, stalls, hits max iterations, errors, or is deleted. Gate deltas drive gutter detection. Checkpoints persist state for crash recovery.

**Middle loop (Orchestrator):** Manages all active Ralph Loops across all pipeline columns. 30-second scan cycle. Handles concurrency, blocker deferral, firing constraints, advisor recovery on failure exits, evaluator verdict handling, queue drain.

**Outer loop (Replanner):** Pipeline-wide oversight. Fires when systemic problems accumulate (escalations >= 3, cost >= 75%, gate failures >= 3 tickets, duration >= 8h). Max 3 non-CONTINUE invocations per pipeline run, then auto-pause.

---

## Gate System

### pipeline.gates.yaml

Mandatory file in the working directory. Generate a starter with `kantban pipeline init` (auto-detects Node/Rust/Python/Go).

```yaml
default:                          # gates applied to all pipeline columns
  - name: typecheck
    run: "pnpm typecheck"
    required: true                # blocks ticket movement if failing
    timeout: 60s
  - name: lint
    run: "pnpm lint"
    required: false               # advisory only

columns:
  implementation:
    extend: true                  # inherit defaults + add these
    gates:
      - { name: build, run: "pnpm build", required: true, timeout: 120s }
  qa:
    extend: false                 # REPLACE defaults entirely
    gates:
      - { name: e2e, run: "pnpm test:e2e", required: true, timeout: 300s }

settings:
  cwd: .
  env: { CI: "true" }
  total_timeout: 300s
  budget: { max_input_tokens: 5000000, max_output_tokens: 1500000, warn_pct: 75 }
  pricing:                        # optional -- enables dollar cost estimates
    sonnet: { input_per_mtok: 3.0, output_per_mtok: 15.0 }
    haiku: { input_per_mtok: 0.25, output_per_mtok: 1.25 }
```

### Gate Resolution

- No column override: returns `default` gates
- `extend: false`: column gates replace defaults entirely
- `extend: true`: merges default + column gates; column gates override defaults by name
- Worktree columns: a synthetic `__worktree_merge` gate (`git merge <integration_branch> --no-edit`) is prepended automatically

### Gate Proxy

Intercepts `move_ticket` and `complete_task` MCP calls from the agent. Before forwarding, resolves gates for the current column, filters any waived gates (set by advisor RELAX_WITH_DEBT), runs remaining gates. Required gate failure returns `GATE_FAILURE` with results and a hint; agent must fix before retrying the move.

### Gate Snapshots

In-memory per-ticket gate history. After each iteration, results are recorded and a delta is computed:

| Delta | Meaning | Gutter impact |
|---|---|---|
| `first_check` | No previous snapshot | None |
| `improved` | More gates passing (or same count with different errors) | Reset to 0 |
| `same` | Same passing count, same error outputs | +1 |
| `regressed` | Fewer gates passing | +2 |

Gate snapshots feed into stuck detection, advisor input, and prompt composer (previous gate results section).

---

## Evaluator Columns

Columns with `column_type: "evaluator"` act as adversarial QA gates. They always run in heavy tier with full tool access.

**Prompt:** Includes an adversarial preamble ("You are an ADVERSARIAL REVIEWER"), ticket info, handoff data, gate results, and code diff. The agent must output a structured verdict:

```json
{ "decision": "approve"|"reject", "summary": "...", "findings": [{ "severity": "blocker"|"warning"|"nit", "description": "...", "file": "...", "line": 42 }] }
```

**Verdict resolution:**

| Decision | Findings | Action |
|---|---|---|
| `approve` | any | Forward to next pipeline column |
| `reject` | has blockers | Reject: move BACK to previous pipeline column with findings |
| `reject` | only warnings/nits | Forward with signals created for each finding |

Pipeline columns identified as: `(has_prompt=true OR type=evaluator) AND type !== done`.

**Parse failure:** If the evaluator output cannot be parsed as a valid verdict, the ticket is held in place with a comment — no movement, no infinite bounce.

---

## Advisor

Post-failure recovery invoked when a Ralph Loop exits with `stalled`, `error`, or `max_iterations`. Budget configurable per-column via `advisor.max_invocations` (default 2).

| Action | Behavior |
|---|---|
| `RETRY_WITH_FEEDBACK` | Adds feedback as comment, re-spawns loop in same column |
| `RETRY_DIFFERENT_MODEL` | Escalates to next model in routing ladder, re-spawns |
| `RELAX_WITH_DEBT` | Records debt items, sets gate waivers, creates debt signal, moves ticket forward |
| `SPLIT_TICKET` | Creates child tickets from split specs, archives parent |
| `ESCALATE` | Moves ticket to circuit breaker target column for human review |

**Decision guide (from gate patterns):**

| Gate pattern | Recommended |
|---|---|
| Same test failing, different error each time | RETRY_WITH_FEEDBACK |
| Same exact error every iteration | RETRY_DIFFERENT_MODEL |
| All gates pass but agent didn't move | RETRY_WITH_FEEDBACK |
| Gates regressing across iterations | SPLIT_TICKET |
| Zero gates pass after max iterations | ESCALATE |
| Most pass, one stubborn failure | RELAX_WITH_DEBT |

---

## Replanner

Pipeline-wide outer loop. Fires when systemic problems accumulate. Max 3 invocations per pipeline run, then auto-pause. Uses Haiku, tool-less invocation.

**Triggers (any one fires it):**
1. Escalated tickets >= 3
2. Token usage >= 75% of budget
3. Any gate failing on >= 3 tickets
4. Pipeline duration >= 480 minutes

| Action | Behavior |
|---|---|
| `CONTINUE` | No change |
| `PAUSE_PIPELINE` | Halts all scans and spawns |
| `ARCHIVE_TICKETS` | Archives specified ticket IDs |
| `CREATE_SIGNAL` | Creates signal on all pipeline columns |
| `ADJUST_BUDGET` | Not yet implemented (treated as CONTINUE) |
| `ESCALATE_ALL` | Pauses pipeline |

---

## Prompt Composer

Token-budgeted prompt assembly. 12 sections in order:

1. **System preamble** (800 tokens) -- identity, iteration N/M, tools, rules, worktree instructions
2. **Signals** -- ticket + column guardrails
3. **Previous gate results** (500 tokens) -- PASS/FAIL per gate with error snippets
4. **Rejection elevation** (500 tokens) -- previous evaluator findings
5. **Column prompt document** -- NEVER truncated
6. **Lookahead** (1000 tokens) -- downstream column criteria
7. **Run memory** (1000 tokens) -- cross-agent discoveries
8. **Ticket details** (1500 tokens) -- title, description, fields, links, history
9. **Comments** (2000 tokens) -- windowed: pinned always full, last 3 full, older first-line only
10. **Transition rules** (500 tokens)
11. **Linked documents** (2000 tokens)
12. **Metadata** (200 tokens) -- iteration, project ID, tool prefix, column name, goal

---

## Cost Tracker

Per-invocation token recording with breakdowns by ticket, column, and model. Configured via `settings.budget` in `pipeline.gates.yaml`.

- `isWarning()` -- true when input tokens >= `warn_pct`% of budget
- `isExhausted()` -- true when input or output tokens exceed budget
- Cost report printed at shutdown. Dollar estimates included if `settings.pricing` is configured.

---

## Light Call

Ultra-light Haiku invocation for columns without prompt documents (`invocation_tier: "light"` or auto-detected). Uses Haiku model, 3 max turns, no tools, no MCP config.

Available actions: `move_ticket`, `set_field_value`, `create_comment`, `archive_ticket`, `no_action`.

---

## Run Memory

Cross-agent knowledge persistence via a KantBan document. Enable per-column with `run_memory: true`. Creates a document titled `Pipeline Run Memory -- <board> -- <date>` with sections: Codebase Conventions, Discovered Interfaces, Failure Patterns, QA Rejection History.

Agents append to sections via the prompt composer. Writes are queued for concurrency safety (fire-and-forget). Content auto-compacted when line count exceeds threshold.

---

## Checkpoint

Loop state persistence for crash recovery. Enable per-column with `checkpoint: true`. Stored as a `loop_checkpoint` field value on the ticket.

Persisted state: `run_id`, `column_id`, `iteration`, `gutter_count`, `advisor_invocations`, `model_tier`, `last_fingerprint`, `worktree_name`. On restart, the orchestrator reads the checkpoint and resumes the loop from where it left off.

Checkpoints are cleared on terminal exits (moved, stalled, error). Stale checkpoints (>10 hours) are ignored.

---

## Model Routing

Escalation ladder for stuck agents. Configure per-column:

```json
{
  "model_routing": {
    "initial": "claude-sonnet-4-6",
    "escalation": ["claude-opus-4-6"],
    "escalate_after": 2
  }
}
```

The agent starts with `initial`. After `escalate_after` advisor RETRY_DIFFERENT_MODEL calls, the next model in `escalation` is used. Model overrides from routing take precedence over `model_preference`.
