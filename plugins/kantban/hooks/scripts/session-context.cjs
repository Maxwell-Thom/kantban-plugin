#!/usr/bin/env node
// session-context.js — KantBan SessionStart hook
// Fetches dashboard context and prints a short summary to stdout.
// Must complete in <2 seconds. On ANY error, outputs nothing and exits 0.
// No npm dependencies — built-in Node.js only (Node 18+ required for fetch).

'use strict';

const { execSync } = require('child_process');

async function main() {
  const apiToken = process.env.KANTBAN_API_TOKEN;
  const apiUrl = process.env.KANTBAN_API_URL;

  // Bail silently if credentials are missing
  if (!apiToken || !apiUrl) return;

  // Allow opt-out via env var
  if (process.env.KANTBAN_SESSION_CONTEXT === 'false') return;

  // Fetch dashboard with a 2-second hard timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);

  let dashboard;
  try {
    const res = await fetch(`${apiUrl}/users/me/dashboard`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      signal: controller.signal,
    });
    if (!res.ok) return;
    dashboard = await res.json();
    // Unwrap KantBan API envelope { success: true, data: {...} }
    dashboard = dashboard.data ?? dashboard;
  } catch {
    // Network error, timeout, parse failure — exit silently
    return;
  } finally {
    clearTimeout(timer);
  }

  // Resolve current git branch (optional — skip if not in a repo)
  let branchName = null;
  try {
    branchName = execSync('git branch --show-current', { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    // Not a git repo or git not available — that's fine
  }

  // Extract a ticket prefix from the branch name (e.g. PROJ-18 from feat/PROJ-18-add-login)
  let branchTicket = null;
  if (branchName) {
    const match = branchName.match(/([A-Z]+-\d+)/);
    if (match) branchTicket = match[1];
  }

  // --- Build output (target ~15 lines) ---
  const lines = [];

  // Top-level counts (boards and tickets are nested inside projects)
  const projects = dashboard.projects ?? [];
  const projectCount = projects.length;
  const boardCount = projects.reduce((sum, p) => sum + (p.boards?.length ?? 0), 0);
  const myTickets = projects.flatMap((p) => p.my_tickets ?? []);
  const assignedCount = myTickets.length;

  lines.push(`KantBan — ${projectCount} project(s) · ${boardCount} board(s) · ${assignedCount} ticket(s) assigned to you`);

  // Top priority ticket
  const topTicket = dashboard.top_priority_ticket ?? myTickets[0] ?? null;
  if (topTicket) {
    const age = topTicket.age_days != null ? `${topTicket.age_days}d old` : '';
    const parts = [
      topTicket.prefix ?? topTicket.id,
      topTicket.title,
      `[${topTicket.column ?? topTicket.status ?? 'unknown'}]`,
      topTicket.priority ? `priority: ${topTicket.priority}` : null,
      age || null,
    ].filter(Boolean);
    lines.push(`Top priority: ${parts.join(' — ')}`);
  }

  // WIP violations
  const violations = dashboard.wip_violations ?? [];
  if (violations.length > 0) {
    lines.push(`WIP violations (${violations.length}):`);
    for (const v of violations.slice(0, 3)) {
      lines.push(`  • ${v.board_name} / ${v.column_name}: ${v.count}/${v.limit} tickets`);
    }
    if (violations.length > 3) {
      lines.push(`  … and ${violations.length - 3} more`);
    }
  }

  // Branch → ticket match
  if (branchTicket) {
    // Search all tickets across all projects for the branch prefix match
    const allTickets = projects.flatMap((p) => {
      const prefix = p.ticket_prefix ?? '';
      return (p.boards ?? []).flatMap((b) =>
        (b.tickets ?? []).map((t) => ({ ...t, prefix: `${prefix}-${t.ticket_number}` }))
      ).concat(
        (p.my_tickets ?? []).map((t) => ({ ...t, prefix: `${prefix}-${t.ticket_number}` }))
      );
    });
    const linked = allTickets.find(
      (t) => t.prefix.toUpperCase() === branchTicket.toUpperCase()
    ) ?? dashboard.branch_ticket ?? null;

    if (linked) {
      const assignee = linked.assignee ? ` · assigned to ${linked.assignee}` : '';
      lines.push(
        `Branch ${branchName} → ${branchTicket}: "${linked.title}" [${linked.column ?? linked.status ?? 'unknown'}]${assignee}`
      );
      if (linked.pr_url || linked.pr_number) {
        const pr = linked.pr_url
          ? linked.pr_url
          : `PR #${linked.pr_number}`;
        lines.push(`  Linked PR: ${pr}`);
      }
    } else {
      lines.push(`Branch ${branchName} → ticket ${branchTicket} (no match in dashboard)`);
    }
  }

  // Available commands
  lines.push('');
  lines.push('Commands: /plan-feature · /whats-next · /board-health · /schedule-standup · /schedule-health');

  // Auto-standup notice
  if (process.env.KANTBAN_AUTO_STANDUP === 'true') {
    lines.push('[Auto-standup enabled — run daily-standup prompt on first interaction]');
  }

  console.log(lines.join('\n'));
}

main();
