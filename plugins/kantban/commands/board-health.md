---
description: "Deep analysis of board health with actionable suggestions"
argument-hint: "Board name or ID (optional)"
---

# /board-health — Board Health Analysis

Run a deep analysis of a board's health and get actionable suggestions for improving flow, reducing bottlenecks, and clearing stale work.

## Steps

### 1. Resolve board context

**If a board ID or name was provided as an argument**, use it to identify the target board. Resolve a name to an ID by reading `kanban://my/dashboard` if needed.

**If no argument was provided**, read `kanban://my/dashboard` and either:
- Use the configured default board if one exists in CLAUDE.md (`kantban.default_board`)
- Ask the user to pick from the available boards

Hold the resolved `boardId` and `projectId` for the next step.

### 2. Dispatch the board-analyst agent

Delegate to the `board-analyst` agent for heavyweight analysis. Pass the resolved `boardId` and `projectId` as inputs.

The board-analyst agent will:
- Read the full board state
- Call `kantban_detect_bottlenecks` to identify flow problems
- Analyse WIP, cycle time, blocked tickets, and stale work
- Produce a structured health report with actionable suggestions

### 3. Present results

Relay the agent's output to the user. The report will include:
- An overall health score or summary
- Identified bottlenecks and their causes
- Stale or blocked tickets that need attention
- Specific, prioritised recommendations

### 4. Offer follow-up actions

After presenting the report, offer relevant next steps based on findings, such as:
- Moving or archiving specific stale tickets
- Rebalancing WIP across columns
- Starting work on a blocked dependency
- Running `/plan-feature` to decompose an oversized ticket

## Notes

This command delegates to a subagent for analysis — it is intentionally heavyweight. For a quick next-task lookup, use `/whats-next` instead.
