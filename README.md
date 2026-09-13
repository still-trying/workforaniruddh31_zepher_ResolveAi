# ResolveAI — Autonomous Customer Resolution Agent

> **ResolveAI** is an autonomous agent that investigates customer cases across simulated enterprise systems, executes permitted resolutions, verifies state changes, and dynamically replans when its original resolution becomes infeasible.

This is **not a chatbot**. A chatbot generates text. ResolveAI **changes system state and proves it did.**

---

## ✨ What It Does

Given a customer complaint (e.g. *"My headphones arrived damaged, I want a replacement"*), ResolveAI autonomously runs this loop — with zero human intervention:

```
UNDERSTAND → INVESTIGATE → REASON → ACT → VERIFY → REPLAN → RESOLVE / ESCALATE
```

| Step | What happens |
|---|---|
| **Understand** | Parses the customer's free-text intent |
| **Investigate** | Retrieves customer, order, product, inventory & policy data via deterministic tools |
| **Reason** | Gemini decides the next action based solely on retrieved evidence |
| **Act** | Backend executes a state-changing tool (refund / replacement / cancellation / return) |
| **Verify** | Confirms the DB state actually changed — not just that the tool returned without error |
| **Replan** | If the action is blocked (e.g. inventory zero, policy disallows), the agent finds an alternative |
| **Resolve** | Case ends in `resolved` or `escalated` — never left ambiguously open |

Every step is logged to `agent_actions` and rendered live in the UI.

---

## 🖥️ Pages

| # | Route | Purpose |
|---|---|---|
| 1 | `/case` | Customer case intake — free-text or predefined demo scenario |
| 2 | `/execution/[caseId]` | **The agent in action** — live step-by-step view of investigate → act → verify → replan |
| 3 | `/resolution/[caseId]` | Final resolution summary with verification checklist |

---

## 🎬 Demo Scenarios

Five deterministic scenarios ship with the seed data, each exercising a different agent behavior:

| # | Scenario | Key Behavior |
|---|---|---|
| 1 | **Successful Replacement** | Damaged item, inventory available → replacement created & verified |
| 2 | **Replacement → Refund (flagship)** | Damaged item, inventory **zero** → agent detects blocker, replans, executes refund |
| 3 | **Cancellation Blocked → Return** | Order already shipped → cancellation disallowed → agent issues return request |
| 4 | **Direct Refund Approval** | Policy allows refund directly → executed and verified |
| 5 | **Escalation** | All resolution paths blocked → case escalated with logged reason |

Scenario 2 is the most important — it demonstrates the full investigate → act → **blocked** → replan → act → verify loop.

---

## 🏗️ Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| AI Reasoning | Google Gemini API (server-side only) |
| Backend / Compute | Next.js Route Handlers + Supabase Edge Functions |
| Database | Supabase Postgres |
| Testing | Vitest |
| Git hooks | Husky (typecheck + lint + tests on pre-push) |

**Gemini never touches the database directly.** It requests tool calls by name; the backend validates, executes deterministically, and returns only the result. This separation keeps the system controllable, debuggable, and auditable.

---

## 📁 Project Structure

```
├── app/
│   ├── case/                     # Page 1 — case intake
│   ├── execution/[caseId]/       # Page 2 — agent execution timeline
│   ├── resolution/[caseId]/      # Page 3 — resolution summary
│   └── api/resolve-case/         # Agent loop API route handler
├── lib/
│   ├── agent/
│   │   ├── gemini.ts             # Gemini API client with retry/backoff
│   │   └── loop.ts               # Agent orchestration loop (MAX_ITERATIONS guard)
│   ├── tools/                    # One file per deterministic backend tool
│   │   ├── get-customer.ts
│   │   ├── get-order.ts
│   │   ├── get-product.ts
│   │   ├── get-inventory.ts
│   │   ├── get-policy.ts
│   │   ├── create-refund.ts
│   │   ├── create-replacement.ts
│   │   ├── cancel-order.ts
│   │   ├── create-return.ts
│   │   ├── verify-case.ts
│   │   └── log-action.ts
│   └── supabase/                 # Supabase client setup
├── supabase/
│   ├── migrations/               # SQL schema migrations
│   ├── seed.sql                  # Demo data seed
│   └── functions/resolve-case/   # Edge Function entrypoint
├── tests/
│   ├── agent/                    # Gemini integration + retry tests
│   └── tools/                    # Unit tests for every tool function
├── types/                        # Shared TypeScript types
└── scripts/                      # Seed & scenario runner scripts
```

---

## ⚙️ Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com) Gemini API key

### 1. Clone & install

```bash
git clone https://github.com/still-trying/workforaniruddh31_zepher_ResolveAi.git
cd workforaniruddh31_zepher_ResolveAi
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

> ⚠️ **Never** prefix these with `NEXT_PUBLIC_` — they are server-side only. The Gemini key must never reach the browser.

### 3. Set up the database

Run the migration against your Supabase project:

```bash
npx supabase db push
# or apply manually via the Supabase dashboard SQL editor
```

Then seed the demo data:

```bash
npx tsx scripts/setup-db.ts
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → click **Start Demo** → pick a scenario → watch the agent work.

---

## 🧪 Testing

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# All tests (unit + integration)
npm run test

# Tool unit tests only (fast — hits the real DB)
npm run test:tools

# End-to-end scenario runner
npm run test:scenarios
```

All 51 tests pass across 12 test files. The pre-push hook enforces `typecheck + lint + test:tools` before every push.

### Test coverage

| Area | Tests |
|---|---|
| Tool functions (`get_*`, `create_*`, `cancel_*`, `verify_*`) | 45 unit tests |
| Gemini integration (tool call shape, retry logic) | 6 tests |
| **Total** | **51 tests · 12 files** |

---

## 🔑 Agent Tools

### Read-only (investigation)

| Tool | Returns |
|---|---|
| `get_customer(customer_id)` | `{ id, name, email, customer_tier }` |
| `get_order(order_id)` | `{ id, customer_id, product_id, status, order_date, delivery_date, price }` |
| `get_product(product_id)` | `{ id, name, category, price }` |
| `get_inventory(product_id)` | `{ product_id, available_quantity, warehouse }` |
| `get_policy(policy_type)` | `{ id, policy_type, rules }` (structured JSON, not free text) |

### State-changing (action)

| Tool | Returns |
|---|---|
| `create_refund(order_id)` | `{ order_id, refund_status: 'processed', amount }` |
| `create_replacement(order_id)` | `{ order_id, replacement_status: 'created', new_order_id }` |
| `cancel_order(order_id)` | `{ order_id, status: 'cancelled' }` |
| `create_return(order_id)` | `{ order_id, return_status: 'created' }` |

### Verification

| Tool | Returns |
|---|---|
| `verify_case(case_id)` | `{ case_id, verified: boolean, checks: [...] }` |

Every action tool **re-validates its own preconditions server-side** before mutating state — it never trusts that Gemini already checked correctly.

---

## 🗄️ Database Schema

```
customers       id, name, email, customer_tier
products        id, name, category, price
inventory       product_id, available_quantity, warehouse
orders          id, customer_id, product_id, status, order_date, delivery_date, price
policies        id, policy_type, rules (jsonb)
cases           id, customer_id, order_id, customer_message, status, resolution (jsonb)
agent_actions   id, case_id, step, tool, input, output, status, timestamp
```

`agent_actions` is the heart of the demo — it's the audit trail that proves the system is a real agent, not a single LLM call dressed up as one.

---

## 🚀 Build

```bash
npm run build
```

Produces an optimized Next.js production build. All routes are verified at build time.

---

## 📄 License

MIT — see [LICENSE](./LICENSE).

---

<div align="center">
  <strong>ResolveAI</strong> · Built with Next.js + Gemini + Supabase
</div>
