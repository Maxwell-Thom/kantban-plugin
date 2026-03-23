# Planning Workflow Reference

This file describes the full planning flow for decomposing features into kanban tickets. Follow this when a user asks Claude to plan a feature, project, or body of work.

---

## Step 1: Understand the Feature

Before creating any tickets, understand what the user wants to build.

**Ask at most 2-3 clarifying questions.** Only ask if the answer would meaningfully change how you decompose the work. Good questions:

- "Is this replacing an existing system or net-new?"
- "What's the rough acceptance bar — MVP, or production-ready?"
- "Are there known dependencies or blockers?"

**Don't ask:**
- Questions whose answers you can infer from context.
- Questions about implementation details you'll figure out while building.
- Open-ended questions that produce more questions.

If the feature is clear, skip to step 2 immediately.

---

## Step 2: Decompose into Right-Sized Tickets

Break the feature into tickets that a single person can complete in **1-2 hours of focused work**. This sizing is important:

- Too large = the ticket sits In Progress forever, losing signal.
- Too small = overhead exceeds the work, creating noise.

**Good ticket anatomy:**

```
Title:    [Verb] [object] [qualifier if needed]
          "Add Google OAuth login endpoint"
          "Write migration for users table"
          "Implement token refresh logic"

Column:   To Do (ready to start) or Backlog (not yet scheduled)

Body:
  Context: one sentence on why this exists
  Acceptance criteria: bulleted list of "done" conditions
  Notes: anything the implementer needs to know upfront
```

**Title conventions:**
- Start with an action verb: Add, Build, Write, Implement, Fix, Remove, Update, Migrate, Test, Document.
- Be specific. "Add OAuth" is worse than "Add Google OAuth login with PKCE flow".
- Include the affected area when helpful: "API: Add rate limiting middleware".

**Acceptance criteria examples:**
- "User can log in with Google and is redirected to the dashboard"
- "Token refresh happens automatically when access token expires"
- "Migration runs cleanly on both local and staging environments"

---

## Step 3: Preview with dryRun: true

**Always preview before creating.** Call:

```
kantban_plan_to_tickets({
  description: "<full feature description>",
  boardId: "<target board>",
  dryRun: true
})
```

Show the user the proposed ticket list. Format it clearly:

```
Proposed tickets (8):

1. [To Do] Set up OAuth app credentials in Supabase
   Done when: OAuth app registered, credentials in env vars

2. [To Do] Add /auth/google endpoint to Fastify API
   Done when: Endpoint returns redirect to Google consent screen

... etc
```

Don't create anything yet. The preview is cheap — use it.

---

## Step 4: Adjust and Confirm

Let the user respond to the preview:

- "Looks good" → proceed to step 5.
- "Merge tickets 3 and 4" → adjust the decomposition.
- "Add a ticket for writing tests" → add it.
- "That's too granular" → consolidate into larger tickets.

Be responsive. The user knows the work better than you do. Your job is to propose a good starting point, not to defend it.

---

## Step 5: Create Tickets

When the user approves, create them:

```
kantban_plan_to_tickets({
  description: "<feature description + any adjustments from review>",
  boardId: "<target board>",
  dryRun: false
})
```

Confirm what was created: "Created 8 tickets in the To Do column. PROJ-24 through PROJ-31."

Offer to start on the first one: "Want to start with PROJ-24?"

---

## Common Pitfalls

### Tickets that are too large

**Symptom:** A ticket title contains "and" or "all" or spans multiple concerns.
- "Build authentication system" → split into: setup, endpoints, token logic, refresh logic, tests, docs.
- "Migrate database and update API" → two separate tickets (or more).

**Fix:** Ask "what's the smallest unit of work I could ship here?" Keep splitting until each piece is independently deployable or testable.

### Tickets that are too vague

**Symptom:** The title doesn't tell you how to start or how to know you're done.
- "Improve performance" → vague. "Reduce /api/tickets endpoint P95 from 800ms to under 200ms" → actionable.
- "Fix bugs" → vague. "Fix null pointer in ticket archiving when column is missing" → specific.

**Fix:** Add enough context that a fresh pair of eyes could pick this up and know where to start.

### Missing acceptance criteria

Every ticket needs a definition of done. Without it:
- "Done" means different things to different people.
- Reopened tickets waste time.
- Metrics (cycle time, velocity) become unreliable.

If a ticket doesn't have obvious acceptance criteria, add a placeholder: "Acceptance criteria: TBD — clarify with team before starting."

### Wrong column placement

- New unscheduled work → **Backlog**
- Work planned for the current sprint/week → **To Do**
- Work already in progress → **In Progress** (usually auto-set by `kantban_start_working_on`)
- Never put new tickets directly in Done or Review.

---

## Multi-Phase Features

For large features that span multiple weeks:

1. **Plan phase 1 only.** Create concrete tickets for the first 1-2 weeks of work.
2. **Capture future phases** in a linked document or in the description of a "Phase 2 Planning" ticket in the Backlog.
3. **Don't create tickets for work more than ~2 weeks out.** Scope changes — tickets created too early often become stale and misleading.
4. **Revisit during grooming.** When phase 1 is nearly complete, run the planning flow again for phase 2.

Example:

```
Phase 1 tickets (create now):
  PROJ-30: Set up database schema for notifications
  PROJ-31: Add notifications table migration
  PROJ-32: Build /api/notifications endpoint
  PROJ-33: Add WebSocket push for new notifications

Phase 2 (backlog ticket as placeholder):
  PROJ-34: [Backlog] Plan notification preferences and email digests
    → "Phase 2 of notifications. Details TBD after phase 1 ships."
```

---

## When Not to Use plan_to_tickets

Use `kantban_create_ticket` (single) instead when:
- The user wants to create one specific ticket with known details.
- The work is already well-understood and doesn't need decomposition.
- The user is adding to an existing sprint, not starting a new feature.

Use `kantban_create_tickets` (batch) instead when:
- You know exactly what the tickets are and don't need the AI decomposition logic.
- You're restoring archived tickets or importing from another tool.
