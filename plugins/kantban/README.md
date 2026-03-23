# KantBan MCP Plugin

Turn your kanban board into Claude's external memory.

## Features

- **96 MCP tools** — full CRUD for boards, columns, tickets, comments, fields, documents, plus compound tools, analytics, GitHub integration, and playbooks
- **5 resources** — dashboard, board snapshot, next tasks, project health, recent activity
- **6 prompts** — plan-feature, daily-standup, groom-backlog, link-github, sprint-forecast, run-playbook
- **Skill with work loop & nudges** — an ambient assistant that surfaces what to work on next and reminds you of blocked tickets
- **Commands** — `/plan-feature`, `/whats-next`, `/board-health`, `/schedule-standup`, `/schedule-health`, `/unschedule` built-in slash commands
- **Board-analyst agent** — autonomous agent that detects bottlenecks, flags overdue work, and drafts sprint summaries
- **SessionStart hook** — automatically loads board context at the start of every Claude session
- **Scheduled task recipes** — cron-style recipes for standups, reconciliation, and health checks

## Installation

### Plugin Marketplace

```
/plugin marketplace add kantban/kantban-plugin
/plugin install kantban
```

### Manual MCP Configuration

Add the following to your `.mcp.json`:

```json
{
  "kantban": {
    "command": "npx",
    "args": ["-y", "kantban-mcp"],
    "env": {
      "KANTBAN_API_TOKEN": "${KANTBAN_API_TOKEN}",
      "KANTBAN_API_URL": "${KANTBAN_API_URL}"
    }
  }
}
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `KANTBAN_API_TOKEN` | Yes | API token from KantBan Settings → API Keys |
| `KANTBAN_API_URL` | Yes | Base URL of your KantBan API (e.g. `https://api.kantban.com`) |
| `KANTBAN_SESSION_CONTEXT` | No | Set to `false` to disable SessionStart board summary |
| `KANTBAN_AUTO_STANDUP` | No | Set to `true` to include auto-standup trigger on SessionStart |

For CLAUDE.md overrides (custom personas, tool allow-lists, tone settings), see `skills/kantban-assistant/reference/configuration.md`.

## Commands

| Command | Description |
|---|---|
| `/plan-feature` | Plan a feature and decompose it into board tickets |
| `/whats-next` | Get a prioritized recommendation for what to work on next |
| `/board-health` | Deep analysis of board health with actionable suggestions |
| `/schedule-standup` | Set up a recurring daily standup report via CronCreate |
| `/schedule-health` | Set up recurring board health checks via CronCreate |
| `/unschedule` | List and cancel KantBan-related scheduled jobs |

## Desktop Scheduled Task Recipes

Use these with Claude Desktop's scheduled tasks feature to automate board hygiene.

| Recipe | Schedule | Prompt |
|---|---|---|
| Morning standup | Weekdays 9 AM | `Run the daily-standup prompt for project {id}. Use kantban MCP tools.` |
| End-of-day reconciliation | Weekdays 5 PM | `Check git log today and compare with board state. Suggest tickets for untracked work.` |
| Weekly throughput report | Monday 9 AM | `Run kantban_get_velocity for project {id} and summarize trends.` |
| Sprint health | Every 4 hours | `Run kantban_detect_bottlenecks for board {id} and alert if critical.` |

## License

UNLICENSED — All rights reserved. KantBan.
