# TESTING.md — Testing & Verification Strategy
**Project:** ResolveAI
**Principle:** Prove it, don't assume it. Because this project is largely vibe-coded, nothing is considered "working" until it has been demonstrated against this document — a confident-sounding claim from the AI assistant is not evidence.

---

## 1. Testing Philosophy

- A feature is not "done" because the AI assistant says it built it. It is done when it passes the checks in this document.
- Every ROADMAP.md phase has explicit exit criteria — this document defines *how* those criteria are actually verified, not just described.
- The riskiest part of this system is the agent loop (Gemini deciding next steps) — it must be tested for **determinism and safety**, not just for happy-path correctness.
- Verification inside the app (the `verify_case` tool) and verification of the app (this document) are two different things — don't conflate them.

---

## 2. Levels of Testing

### 2.1 Static checks (run before anything else)
```
[ ] TypeScript strict mode passes with zero errors (npm run typecheck / tsc --noEmit)
[ ] Linter passes with zero errors (npm run lint)
[ ] No `any` types without an explanatory comment
[ ] No unused imports or dead code
```
These must pass before any feature is considered for functional testing. A build with type errors is not eligible for review.

### 2.2 Unit tests — backend tool functions
Every tool listed in ARCHITECTURE.md Section 4 gets its own unit test, run against seeded/mocked data, **in isolation from the Gemini loop**:

```
[ ] get_customer — returns correct data for a known id; handles not-found
[ ] get_order — returns correct data; handles not-found
[ ] get_product — returns correct data; handles not-found
[ ] get_inventory — returns correct quantity, including the zero-inventory case
[ ] get_policy — returns correct structured rules for a known policy_type
[ ] create_refund — succeeds when preconditions are met; returns 'blocked' (not a fabricated success) when they are not
[ ] create_replacement — succeeds when inventory is available; returns 'blocked' when inventory is zero
[ ] cancel_order — succeeds when order status allows; returns 'blocked' when order already shipped
[ ] verify_case — correctly identifies both a genuinely resolved case and a falsely-claimed one
[ ] Every action tool writes a correctly-shaped row to agent_actions
```
**Rule:** these tests must run against the real database schema (a test Supabase instance or local Postgres), not just in-memory mocks, so that schema drift is caught.

### 2.3 Integration tests — `/resolve-case` endpoint
```
[ ] Scenario 1 (Successful Replacement) — full run reaches 'resolved', agent_actions trail is complete and in order
[ ] Scenario 2 (Replacement Unavailable → Refund) — full run reaches 'resolved' via the replan path;
    agent_actions shows the blocked attempt AND the successful alternative, in order
[ ] Scenario 3 (Cancellation Blocked → Alternative) — full run reaches 'resolved' or a valid escalation
[ ] Scenarios 4–5 — same standard applied
[ ] MAX_ITERATIONS cap: a deliberately malformed/looping case escalates instead of hanging
```
Run each scenario **at least 3 times from a clean seed** to catch nondeterminism in Gemini's tool selection. If outcomes vary across runs, the prompting/schema constraining Gemini's tool requests needs tightening — this is a blocking issue, not a nice-to-have fix.

### 2.4 Manual QA — full UI walkthroughs
For each of the 5 demo scenarios, manually walk through all 3 pages:
```
[ ] Page 1: case is submitted or selected correctly
[ ] Page 2: agent activity log renders accurately and in real order, including any blocked/replan steps
[ ] Page 3: final resolution summary matches what actually happened in agent_actions and the DB
[ ] No console errors, no broken states, no infinite spinners
```

### 2.5 Security/architecture conformance checks
```
[ ] GEMINI_API_KEY does not appear in any client bundle (grep build output for the key name)
[ ] Supabase service role key is never referenced outside server-side code
[ ] No code path allows Gemini's output to be executed as SQL or used to directly mutate the DB
[ ] Every action tool independently re-validates preconditions server-side (does not trust Gemini's claim)
```

---

## 3. Definition of "Tested" for a Feature

A feature/tool/endpoint is only considered tested when:
1. It has an automated test (unit or integration, per Section 2.2/2.3) that currently passes.
2. It has been exercised manually at least once against a real seeded scenario (Section 2.4), not just a synthetic unit-test fixture.
3. The relevant `CLAUDE.md` Section 3 post-write review checklist has been explicitly run and its results stated.

No item in `ROADMAP.md` may be checked off as complete until all three conditions above are met.

---

## 4. Required Scripts

Set these up in `package.json` and keep them working throughout the build:
```
npm run typecheck    → tsc --noEmit
npm run lint         → eslint
npm run test         → unit + integration test suite
npm run test:tools   → tool-function unit tests only (fast feedback loop)
npm run test:scenarios → integration tests for the 5 demo scenarios
```

Before ending any work session, run at minimum `npm run typecheck` and `npm run test:tools`. Before closing a ROADMAP.md phase that touches the agent loop, run `npm run test:scenarios`.

---

## 5. Regression Discipline

- After any change to a tool function, prompt, or the agent loop, **re-run all 5 demo scenarios**, not just the one you were working on. A fix to Scenario 2 that silently breaks Scenario 1 is a regression, not a fix.
- Keep a simple log (even a markdown checklist) of the last time each scenario was verified end to end. If it's been more than one phase since a scenario was last re-verified, re-verify it before the next demo/checkpoint.
- Any time `ARCHITECTURE.md`'s schema changes, re-run Section 2.2 (tool unit tests) in full — schema drift is the most common silent breakage in this kind of project.

---

## 6. What "CI/CD" Means for This Project (Kept Deliberately Light)

Given the timeline, a full CI/CD pipeline is not required, but at minimum:
```
[ ] typecheck + lint run automatically before merge/deploy (a simple pre-push hook or GitHub Action is enough)
[ ] test:tools runs automatically before merge/deploy
[ ] Manual sign-off required before deploy for anything touching the agent loop or verification logic
```
Do not spend build time on elaborate pipeline infrastructure — see PRD.md Section 6. The goal is "nothing broken gets deployed," not enterprise-grade DevOps.
