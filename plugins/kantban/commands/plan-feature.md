---
description: "Plan a feature and decompose it into board tickets"
argument-hint: "Describe the feature you want to build"
---

# /plan-feature — Feature Planning Flow

Start the planning flow for a feature or project. Decomposes a description into board tickets, previews them before creating anything, then creates them on confirmation.

## Steps

### 1. Resolve project and board context

If a default project is configured in CLAUDE.md (`kantban.default_project`), use it directly. Otherwise, read the `kanban://my/dashboard` resource to list available projects and boards.

```
Read resource: kanban://my/dashboard
```

Present the project/board list and ask the user to pick one. Once selected, hold the `projectId` and `boardId` for all subsequent calls.

### 2. Get the feature description

If the user provided a description as the command argument, use it as-is.

If no argument was provided, ask:
> "What feature do you want to plan? Describe it briefly — I'll ask follow-up questions if needed."

Ask 2–3 clarifying questions only if the scope is genuinely ambiguous. If the intent is clear, proceed directly to decomposition.

### 3. Invoke the `plan-feature` MCP prompt

Call the `plan-feature` prompt with the resolved project, board, and feature description. The prompt guides the full decomposition conversation.

Inputs:
- `projectId` — resolved in step 1
- `boardId` — resolved in step 1
- `description` — from argument or step 2 conversation

### 4. Preview with dryRun: true

Call `kantban_plan_to_tickets` with `dryRun: true`. Display the proposed ticket list clearly:

```
Proposed tickets (not created yet):
1. [To Do] Add OAuth login with Google
   Done when: User can sign in via Google and session persists.
2. [To Do] Handle OAuth callback and session creation
   Done when: Callback route exchanges code for token and creates session.
...
```

### 5. Adjust and confirm

Let the user edit, remove, or add tickets before committing. Common adjustments:
- Split a ticket that's too large
- Merge two tickets that are trivially small
- Rewrite a vague title to be action-oriented
- Add missing acceptance criteria

Once the user approves the list, call `kantban_plan_to_tickets` with `dryRun: false` to create the tickets.

### 6. Confirm and offer next step

After creation, summarize what was created:
> "Created 5 tickets on the 'Sprint 3' board. Want me to start working on the first one?"

If yes, call `kantban_start_working_on` with the first ticket.

## Good ticket checklist

- Completable in 1–2 hours of focused work
- Action-oriented title ("Add OAuth login" not "OAuth")
- Clear acceptance criteria — when is this ticket done?
- Correct column (new work belongs in Backlog or To Do)
- Not too large ("Build the entire API layer" → split it)
- Not too vague ("Make it better" → what does done look like?)
