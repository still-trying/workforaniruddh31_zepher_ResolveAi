# ROADMAP.md — Implementation Plan
**Project:** ResolveAI
**Deadline:** September 13, 2026, 10:00 PM
**Rule:** One phase per work session. Do not start Phase N+1 until Phase N's exit criteria are all checked AND its required tests (see TESTING.md) pass. Reference the phase number explicitly when asking the AI assistant to work ("Execute Phase 4").

---

## How to use this document

- Each phase has a **Goal**, a **Task Checklist**, and **Exit Criteria**.
- The AI assistant must not implement work from a later phase while "in" an earlier one, even if it seems convenient.
- Before marking a phase complete, run its Exit Criteria against `TESTING.md` and against the `CLAUDE.md` Section 3 post-write review checklist.
- If a phase reveals that an earlier document (PRD/ARCHITECTURE) needs to change, stop and follow the Change Control process in PRD.md Section 11 before continuing.

---

## Phase 0 — Project Setup
**Goal:** A running skeleton, nothing functional yet.

```
[ ] Initialize Next.js + TypeScript + Tailwind project
[ ] Create Supabase project
[ ] Set up environment variables (GEMINI_API_KEY server-side only, Supabase keys)
[ ] Set up folder structure per ARCHITECTURE.md Section 7
[ ] Verify the app builds and runs locally with a placeholder homepage
```
**Exit criteria:** App builds, runs, and connects to Supabase with no errors. No business logic yet.

---

## Phase 1 — Database Schema
**Goal:** All tables exist exactly as specified in ARCHITECTURE.md Section 3.

```
[ ] Create customers table
[ ] Create products table
[ ] Create inventory table
[ ] Create orders table
[ ] Create policies table
[ ] Create cases table
[ ] Create agent_actions table
[ ] Write migration files (not just manual dashboard changes)
```
**Exit criteria:** Schema matches ARCHITECTURE.md exactly (column names, types). Migrations are reproducible.

---

## Phase 2 — Seed Realistic Simulated Data
**Goal:** Enough data to run all 4–5 demo scenarios deterministically.

```
[ ] Seed 3–5 customers (varying tiers)
[ ] Seed 3–5 products
[ ] Seed inventory rows, including at least one product with available_quantity = 0
    (required for the flagship replacement-unavailable scenario)
[ ] Seed 5+ orders in varying statuses (placed, shipped, delivered)
[ ] Seed policies for: damaged_item, cancellation, and at least one more policy_type
[ ] Seed at least one case per required demo scenario (PRD.md Section 8)
```
**Exit criteria:** Data supports all 5 required demo scenarios without further manual edits. Verified by manually querying each seeded case's dependencies.

---

## Phase 3 — Backend Tool Functions
**Goal:** Every tool from ARCHITECTURE.md Section 4 exists, is deterministic, and is independently testable.

```
[ ] get_customer(customer_id)
[ ] get_order(order_id)
[ ] get_product(product_id)
[ ] get_inventory(product_id)
[ ] get_policy(policy_type)
[ ] create_refund(order_id) — re-validates preconditions before mutating
[ ] create_replacement(order_id) — re-validates inventory before mutating
[ ] cancel_order(order_id) — re-validates order status before mutating
[ ] verify_case(case_id)
[ ] Every action tool writes a row to agent_actions
```
**Exit criteria:** Each tool has a passing unit test (see TESTING.md) run in isolation, with mocked/seeded data, before moving on. No tool is "tested via the UI only."

---

## Phase 4 — Connect Gemini API
**Goal:** The backend can call Gemini server-side and get back a structured "next tool to call" decision.

```
[ ] Server-side Gemini client set up (key never exposed to frontend)
[ ] Define the tool-calling contract/schema Gemini uses to request a tool
[ ] Confirm Gemini can be prompted with case context and returns a valid, parseable tool request
[ ] Confirm Gemini never receives raw DB credentials or is asked to write SQL
```
**Exit criteria:** A manual test call to Gemini returns a valid structured tool request for a known seeded case.

---

## Phase 5 — Agent Loop (`/resolve-case`)
**Goal:** The core orchestration loop described in ARCHITECTURE.md Section 5 works end to end.

```
[ ] Implement the while-loop: Gemini decides → backend validates → executes → logs → returns result → Gemini decides next
[ ] Hard iteration cap (MAX_ITERATIONS) implemented and enforced
[ ] Exceeding the cap sets case status to 'escalated' with a logged reason
[ ] Case status transitions correctly: open → in_progress → resolved/escalated
```
**Exit criteria:** Calling `/resolve-case` on a seeded "successful replacement" case reaches `resolved` with a fully populated `agent_actions` trail, with no manual intervention.

---

## Phase 6 — Verification Logic
**Goal:** The agent doesn't just claim success — it proves it.

```
[ ] verify_case checks the actual DB state matches the claimed outcome
    (e.g., refund_status really is 'processed', inventory really decremented)
[ ] Verification result is logged to agent_actions like any other step
[ ] A case is not marked 'resolved' unless verification passes
```
**Exit criteria:** Deliberately breaking a mutation (e.g., simulating a failed write) causes verification to fail and the case to NOT resolve silently.

---

## Phase 7 — Replanning Logic
**Goal:** The flagship behavior — the agent adapts when its first plan is blocked.

```
[ ] Agent detects a blocked action (e.g., inventory unavailable) as 'blocked', not 'error'
[ ] Agent investigates a valid alternative (e.g., refund eligibility) using existing tools
[ ] Agent executes and verifies the alternative
[ ] Full sequence, including the blocked attempt, is visible in agent_actions
```
**Exit criteria:** The "Replacement Unavailable → Refund" scenario (PRD.md Section 8, Scenario 2) runs end to end and resolves correctly, every time it's re-run against the same seed.

---

## Phase 8 — Agent Execution Dashboard (Frontend)
**Goal:** Page 2 from PRD.md Section 5 — the most important UI screen.

```
[ ] Live/step-by-step rendering of agent_actions for a given case
[ ] Clear visual distinction between success (✓), blocked (⚠), and replanning (↻) steps
[ ] Reflects real backend state — not a scripted/faked animation
```
**Exit criteria:** Watching this screen for the flagship scenario clearly shows the blocked step and the replan, sourced from real data.

---

## Phase 9 — Case Intake & Resolution Pages (Frontend)
**Goal:** Pages 1 and 3 from PRD.md Section 5.

```
[ ] Page 1: free-text entry + selectable demo scenarios
[ ] Page 3: final resolution summary (requested action, outcome, alternative, reason, verification checklist)
[ ] Navigation between all 3 pages works for a full case lifecycle
```
**Exit criteria:** A user can go from typing an issue to seeing a fully resolved case with no dead ends or console errors.

---

## Phase 10 — Demo Scenario Hardening
**Goal:** All 4–5 required scenarios (PRD.md Section 8) are reliable, not just "worked once."

```
[ ] Re-run each scenario 3+ times from a clean seed; confirm consistent outcomes
[ ] Confirm both Definition of Done paths (PRD.md Section 9) pass reliably
[ ] Fix any nondeterminism in Gemini's tool selection (tighten prompting/schema if needed)
```
**Exit criteria:** All scenarios in PRD.md Section 8 are demo-ready and repeatable.

---

## Phase 11 — Polish
**Goal:** Only after everything above works. Do not pull polish work earlier.

```
[ ] UI cleanup (spacing, copy, empty/error states)
[ ] Basic loading/error states on all 3 pages
[ ] Final read-through of PRD.md Section 6 (Out of Scope) to confirm nothing crept in
```
**Exit criteria:** Fresh run-through of both Definition of Done paths, on the deployed/demo build, works without developer intervention.

---

## Explicit Reminder for the AI Assistant

Do not skip ahead. Do not combine phases "for efficiency" unless explicitly instructed. Phase 5 (the agent loop) is the single most important milestone — get it minimally working before investing in UI polish, per PRD.md's development priorities.
