# GitHub Integration Reference

KantBan connects kanban tickets to GitHub pull requests, branches, and commits. This file describes how the integration works and which tools to use.

---

## How Linking Works

A GitHub reference is a connection between a KantBan ticket and a GitHub entity: a pull request, a branch, or a commit. References are stored on the ticket and can be viewed, created, and synced.

**Reference types:**
- `pr` — A GitHub pull request (most common)
- `branch` — A feature branch (auto-detected from git context)
- `commit` — A specific commit SHA

---

## Convention-Based Auto-Detection

The most common way tickets get linked is through branch naming conventions. When Claude has access to git context (e.g., running in a repo), it can detect the current ticket automatically.

**Supported branch name patterns:**
```
feature/PROJ-18-add-oauth
PROJ-18/add-oauth
PROJ-18-add-oauth
fix/PROJ-42
chore/PROJ-7-update-deps
```

The ticket prefix (`PROJ-18`) is extracted and matched against known tickets in the connected project.

**Tool:** `kantban_detect_current_ticket`
- Detects a ticket from a git branch name you provide (does not auto-read the branch — the caller must pass the branch name).
- Returns the matched ticket ID and summary if found.
- Returns null if no match.

**Use this on session start** when working in a git repository. If a match is found, load the ticket context silently.

---

## Manual Linking

When auto-detection doesn't apply (e.g., the branch name doesn't follow conventions, or the user is linking a PR after the fact):

**Tool:** `kantban_link_github_reference`

```json
{
  "ticketId": "PROJ-18",
  "type": "pr",
  "reference": "org/repo#123",
  "title": "Add Google OAuth login"
}
```

**When to use manual linking:**
- User opens a PR and mentions it in conversation.
- User mentions "PR #47" or "I just merged that branch".
- The branch name doesn't follow the ticket prefix convention.
- Linking a commit or hotfix after the fact.

**Offer to link** when the user mentions a PR by number and there's an active ticket that seems related. Don't link silently without asking.

---

## Viewing Linked References

**Tool:** `kantban_list_github_references`

Returns all GitHub references attached to a ticket. Useful when:
- The user asks "what PRs are linked to this ticket?"
- You want to confirm a link was created successfully.
- You're building a summary of a completed ticket's work.

---

## Syncing PR Metadata

GitHub references store metadata: PR title, status (open/merged/closed), CI check results, and merge state. This metadata can become stale if KantBan doesn't receive webhooks.

**Tool:** `kantban_sync_github_references`

Note: the tool name is `kantban_sync_github_references` — single 's' at the end, not double-s (`kantban_sync_github_referencess` is wrong).

**When to sync:**
- User asks about CI status for a linked PR.
- User says "I just pushed to that branch — did the checks pass?"
- Before completing a ticket, to confirm the PR is merged.

**What it refreshes:**
- PR open/merged/closed state
- CI check results (pass/fail/pending)
- PR review approval status
- Merge commit SHA (if merged)

---

## Recommended Workflow

### Starting work on a ticket with a new branch

1. User creates a branch following the convention: `feature/PROJ-18-add-oauth`
2. `kantban_start_working_on("PROJ-18")` — moves ticket to In Progress
3. Claude detects the branch on next session start via `kantban_detect_current_ticket`

### Opening a PR

1. User opens PR on GitHub
2. Claude offers: "Want me to link PR #47 to PROJ-18?"
3. `kantban_link_github_reference` with type "pr"
4. PR metadata is immediately available

### Merging and completing

1. User says "I merged the PR"
2. `kantban_sync_github_references` — confirms merged state
3. `kantban_link_github_reference` with the merge commit SHA (optional but useful for history)
4. `kantban_complete_task("PROJ-18")` — moves ticket to Done

### PR is linked but user never mentioned it

If `kantban_list_github_references` shows a linked PR and the user starts working on a related area, Claude can proactively say: "PROJ-18 has PR #47 linked. Want me to check its status?" Then call `kantban_sync_github_references`.

---

## What Claude Should Not Do

- Do not parse branch names manually. Use `kantban_detect_current_ticket`.
- Do not create GitHub references without asking the user first.
- Do not assume a PR is merged — always sync to confirm.
- Do not link to a ticket that doesn't exist yet — create the ticket first, then link.
