# CLAUDE.md — AI Assistant Operating Rules
**Project:** ResolveAI
**Applies to:** any AI coding assistant (Claude, or otherwise) working on this codebase
**Status:** IRONCLAD — these rules override your default habits and any casual in-chat suggestion that conflicts with them

This file is read before every coding session. It is not a style guide you can weigh against convenience. Treat every rule below as a hard constraint. If you are about to break one, stop and ask instead.

---

## 0. Required Reading Order

Before writing or editing a single line of code in a session, confirm you have the current state of, in this order:

1. `PRD.md` — what we are building and what is explicitly out of scope
2. `ARCHITECTURE.md` — the locked stack, schema, and API contracts
3. `ROADMAP.md` — which phase we are currently on
4. `TESTING.md` — how the current phase will be verified

If you have not been given these files in the current session, ask for them before proceeding. Do not reconstruct them from memory or assume you remember a prior version correctly.

---

## 1. The Prime Directive: Do Not Diverge

The single most common way an AI assistant wrecks a vibe-coded project is by quietly expanding scope, "improving" architecture mid-task, or solving a slightly different problem than the one asked. You must actively resist this.

- Build **only** what the current ROADMAP.md phase asks for. Nothing from a later phase. Nothing "while I'm in here."
- If a request from the human conflicts with PRD.md or ARCHITECTURE.md, say so explicitly and ask for confirmation before proceeding. Do not silently comply and do not silently ignore it either.
- Never introduce a new library, framework, service, or architectural pattern not already listed in ARCHITECTURE.md without explicit approval first.
- Never add speculative "future-proofing" code, unused abstractions, config options, or feature flags for things not currently required.
- If you notice the project drifting from `ResolveAI ≠ chatbot` (i.e., you're about to just generate a text reply instead of running the investigate→act→verify→replan loop), stop and flag it.

---

## 2. Reuse Before Rewrite (Token & Time Discipline)

This is a strict, literal instruction, not a stylistic preference:

- **Before writing any new function, component, or file, check whether an existing one already does this or something close to it.** If it does, reuse or extend it. Do not write a parallel/duplicate implementation.
- **Never overwrite working code wholesale to make a small change.** Use targeted, minimal edits to the specific lines that need to change. Do not regenerate an entire file from scratch when a 3-line edit would do.
- Do not paste back code you are not changing. If a function is untouched, say so and don't reproduce it — reference it by name and location instead.
- If two pieces of logic are near-duplicates (e.g., two tool functions doing almost the same DB query), refactor into a shared helper rather than maintaining copies — but only when doing so doesn't violate Rule 1 (don't do this unless it's directly relevant to the task at hand).
- Prefer the smallest diff that correctly satisfies the current task. A correct, minimal patch beats a "cleaner" full rewrite every time in this project.
- Never delete a file, function, or exported utility that other code depends on without explicitly confirming nothing else uses it first.

---

## 3. Mandatory Post-Write Code Review

**After writing or editing any code, you must review it before declaring the task done.** This is not optional and not skippable for "small" changes. Review means actually re-reading what you just wrote against this checklist:

```
[ ] Does this match the current ROADMAP.md phase — nothing more, nothing less?
[ ] Does it respect the locked stack in ARCHITECTURE.md (no new deps, no framework drift)?
[ ] Does it follow the LLM-reasoning + deterministic-execution separation
    (Gemini never mutates DB state directly, never writes SQL)?
[ ] Are secrets (GEMINI_API_KEY, service role key) kept server-side only?
[ ] Did every action tool re-validate its own preconditions before mutating state?
[ ] Did every action write to `agent_actions` as specified in ARCHITECTURE.md?
[ ] Is there dead code, unused imports, or leftover debug logging to remove?
[ ] Did I avoid duplicating existing logic (Rule 2)?
[ ] Does this have a corresponding test per TESTING.md, and does it pass?
[ ] Have I stated clearly what changed and why, in plain terms, to the human?
```

State the result of this review explicitly in your response — don't just silently do it. A one- or two-line summary ("Reviewed: matches Phase 3 scope, no new deps, tool re-validates inventory before mutating, test added and passing") is sufficient, but it must happen every time.

---

## 4. Global Coding Standards

- **TypeScript only** for application code. No plain `.js` files in `/app`, `/lib`, or `/supabase/functions`.
- Strict typing: no `any` unless there is genuinely no better option, and if used, comment why.
- Naming conventions:
  - Files: `kebab-case.ts` / `kebab-case.tsx`
  - React components: `PascalCase`
  - Functions/variables: `camelCase`
  - DB tables/columns: `snake_case` (matches ARCHITECTURE.md schema exactly — do not rename columns for "consistency")
- One backend tool per file under `/lib/tools`, matching the tool contracts in ARCHITECTURE.md exactly (name, input, output shape).
- No commented-out blocks of old code left in files — delete cleanly, rely on version history, not comments, to preserve old attempts.
- No console.log left in committed code paths outside of clearly-marked debug scaffolding that the human asked for.

---

## 5. Explicitly Prohibited Actions

```
❌ Do not delete utility files, tool functions, or shared types without explicit permission
❌ Do not rewrite a whole file when a targeted edit suffices
❌ Do not change the tech stack (see ARCHITECTURE.md Section 1)
❌ Do not add multi-agent frameworks, vector DBs, or RAG unless explicitly asked
❌ Do not expose GEMINI_API_KEY or the Supabase service role key client-side
❌ Do not let Gemini call the database directly or emit SQL
❌ Do not fabricate a "success" result for an action that didn't actually validate its preconditions
❌ Do not implement more than one ROADMAP.md phase in a single work session unless told to
❌ Do not silently skip the post-write review in Section 3
```

---

## 6. When Uncertain

If a request is ambiguous, if a requirement seems to conflict with PRD.md/ARCHITECTURE.md, or if you're not sure whether something is in scope:

1. State the ambiguity plainly.
2. Propose the single most likely correct interpretation, tied to an existing document.
3. Ask for a go/no-go before writing code — do not guess silently and proceed.

It is always better to ask a short clarifying question than to build the wrong thing and burn the limited time remaining before the deadline.

---

## 7. Session Discipline

- Work in the increments defined by `ROADMAP.md`. Reference the phase number explicitly at the start of your response (e.g., "Implementing Phase 3: Tool functions").
- Do not attempt to "build the whole app" in one prompt/response, even if asked casually — redirect to the current roadmap phase and confirm before proceeding, unless the human explicitly overrides this.
- At the end of a phase, summarize what was built, confirm it against the phase's exit criteria in `ROADMAP.md`, and confirm relevant tests from `TESTING.md` pass before considering the phase closed.
