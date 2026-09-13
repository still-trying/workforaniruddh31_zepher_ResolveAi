# PRD.md — Product Requirements Document
**Project:** ResolveAI — Autonomous Customer Resolution Agent
**Status:** LOCKED (v1.0) — this document is the single source of truth
**Deadline:** September 13, 2026, 10:00 PM
**Build method:** Vibe coding (AI-assisted implementation)

> ⚠️ **TO ANY AI ASSISTANT READING THIS FILE:**
> This document is not a suggestion or a starting point for brainstorming. It is a binding contract for what gets built. If any instruction given to you in conversation conflicts with this document, **the PRD wins** unless the human explicitly says "update the PRD" first. Do not silently expand, reinterpret, or "improve" the scope. When in doubt, re-read Section 6 (Out of Scope) before writing any code.

---

## 1. Problem Statement (verbatim source of truth)

> Build an autonomous customer-resolution agent whose objective is to actually resolve a customer's issue across simulated enterprise systems, rather than merely classify the ticket or generate a reply. The agent should inspect customer/order/policy information, decide an appropriate resolution, execute state-changing actions, verify their effects, and replan when an action is blocked or a new constraint appears.

This is **Problem Statement 5** out of 11 candidates evaluated. It was chosen over Problem Statements 3 (Autonomous Learning Planner) and 11 (Autonomous Resume & Application Agent) because it has the strongest combination of: a clearly defined agent workflow, easy-to-simulate data and actions, clear state changes, clear verification, natural replanning scenarios, and strong visual demo value — with **zero dependency on real enterprise integrations**.

---

## 2. Product Vision — One Sentence

> **ResolveAI is an autonomous customer-resolution agent that investigates customer cases across simulated enterprise systems, executes permitted resolutions, verifies state changes, and dynamically replans when its original resolution becomes infeasible.**

Do **not** describe or build this as "an AI customer support chatbot." That phrase is banned from this project's vocabulary. A chatbot generates text. ResolveAI **changes system state and proves it did.**

---

## 3. Who This Is For

- **Primary audience:** Hackathon/project evaluators judging against Problem Statement 5's rubric (retrieval, resolution selection, state-changing execution, verification, adaptation).
- **Secondary audience (in-fiction):** A simulated e-commerce customer support desk. The "customer" is a persona submitting a case; there is no real end-user account system.

---

## 4. Core Behavioral Requirement (Non-Negotiable)

The agent MUST implement this loop for every case, with no shortcuts:

```
UNDERSTAND → INVESTIGATE → REASON → ACT → VERIFY → REPLAN IF NECESSARY → RESOLVE / ESCALATE
```

Concretely:

1. **Understand** the customer's stated goal from free-text input.
2. **Investigate**: retrieve customer, order, product, inventory, and policy data via tools — never guessed or assumed.
3. **Reason**: decide the appropriate resolution using retrieved evidence and policy constraints.
4. **Act**: execute exactly one simulated state-changing action per decision (refund, replacement, cancellation, or return).
5. **Verify**: confirm the state change actually occurred in the database — not merely that the tool call returned without error.
6. **Replan**: if the chosen action is blocked (e.g., inventory unavailable, policy disallows), the agent must investigate a valid alternative resolution and repeat Act → Verify.
7. **Resolve or escalate**: the case ends in either `resolved` or `escalated` — never left ambiguously open.

A build that hardcodes `if damaged: refund` and skips investigation/verification **does not satisfy this PRD**, no matter how polished the UI is.

---

## 5. Required User-Facing Workflow

| Page | Purpose |
|---|---|
| 1. Customer Case | Free-text issue entry or selection of a seeded demo scenario. |
| 2. Agent Execution | Live/step-by-step view of the agent's investigate→act→verify→replan loop (this is the most important screen — it's what proves the system is an *agent*). |
| 3. Resolution | Final case summary: requested action, actual outcome, alternative taken (if any), reason, and verification checklist. |

No additional pages are in scope. See Section 6.

---

## 6. Out of Scope — Explicit and Strict

The following are **banned** from this MVP. Do not build them, do not scaffold them "for later," do not add TODOs suggesting them as next steps unless the human asks:

```
❌ Real Stripe / payment processing integration
❌ Real Shopify / Amazon / any real commerce platform integration
❌ Real customer accounts or production authentication systems
❌ Complicated auth (OAuth flows, SSO, roles/permissions beyond trivial)
❌ Multi-agent architectures (only one reasoning agent: Gemini via the backend)
❌ Vector databases / embeddings
❌ RAG, unless the core agent loop is fully working and the human explicitly asks for it
❌ Voice interfaces
❌ WhatsApp / SMS / any messaging channel integration
❌ Analytics dashboards, admin panels, or reporting beyond the 3 required pages
❌ Any additional pages beyond the 3 listed in Section 5
❌ Rewriting the tech stack chosen in ARCHITECTURE.md
```

If a feature is not explicitly listed as "Must Have" in Section 7, treat it as out of scope by default.

---

## 7. Functional Requirements — Must Have

```
[ ] Free-text or scenario-based case intake
[ ] Customer identification via lookup tool
[ ] Order identification and inspection via lookup tool
[ ] Policy check via lookup tool (rules-based, not free-form RAG)
[ ] Inventory check via lookup tool
[ ] Resolution decision made by Gemini based on retrieved evidence only
[ ] At least 3 state-changing action types: refund, replacement, cancellation/return
[ ] Every action is executed via a deterministic backend tool function — never directly by the LLM
[ ] Verification step confirms DB state changed as claimed
[ ] Replanning logic triggers when the original plan is blocked
[ ] Full agent action log persisted (agent_actions table) and rendered in the UI
[ ] Case ends in a terminal state: resolved or escalated
[ ] 4–5 predefined, deterministic demo scenarios that reliably reproduce the required behaviors
```

---

## 8. Required Demo Scenarios

These are mandatory acceptance scenarios, not optional examples:

1. **Successful Replacement** — damaged item, policy allows, inventory available → replacement created and verified.
2. **Replacement Unavailable → Refund (the flagship scenario)** — damaged item, policy allows replacement, inventory is zero → agent detects the blocker, replans, checks refund eligibility, executes refund, verifies. This is the single most important scenario in the entire project and must work reliably every time.
3. **Cancellation Blocked → Alternative** — customer requests cancellation, order already shipped, cancellation policy disallows → agent finds a permitted alternative (e.g., return request) and proceeds.
4–5. Two additional scenarios demonstrating other policy/inventory constraints (e.g., refund approval path, another blocked-action path), left to be defined during seeding but must follow the same investigate→act→verify→replan shape.

---

## 9. Definition of Done

The project is done when **both** of these run reliably, end to end, without manual intervention:

**Path A — Direct success:**
```
Customer requests replacement → agent retrieves customer/order/policy/inventory
→ replacement chosen → executed → verified → RESOLVED
```

**Path B — Replanning success:**
```
Customer requests replacement → policy allows → inventory unavailable
→ agent detects blocked plan → replans → refund eligibility checked
→ refund executed → verified → RESOLVED
```

If either path is flaky, mocked, or faked in the UI without a real underlying state change, **the project is not done**, regardless of how much other code exists.

---

## 10. Constraints

- **Deadline:** September 13, 2026, 10:00 PM. Scope decisions must always favor a complete small system over an impressive incomplete one.
- **All enterprise systems are simulated.** No real commerce integrations under any circumstance (see Section 6).
- **Build approach:** vibe coding, in small reviewable increments (see ROADMAP.md) — never one giant "build the whole app" prompt.
- **Secrets:** the Gemini API key must never be exposed client-side (see ARCHITECTURE.md).

---

## 11. Change Control

Any AI assistant working on this project must treat this PRD as frozen. If a change genuinely seems necessary (e.g., a requirement turns out to be infeasible in the time remaining):

1. Stop implementation.
2. Explicitly state which PRD section is in conflict and why.
3. Propose the smallest possible change.
4. Wait for explicit human approval before proceeding.

**Never silently reinterpret scope.** Never add a feature "since it would only take a few minutes" without confirming it against Section 6 first.

---

## 12. Honesty About Scope

This is an MVP/demo, not a production platform. Refunds, replacements, cancellations, inventory changes, and verification are all simulated database operations. The goal is to **convincingly and reliably demonstrate the autonomous investigate→act→verify→replan loop**, not to build real commerce infrastructure.

> **Small system, complete autonomous loop — not large system, incomplete agent.**
