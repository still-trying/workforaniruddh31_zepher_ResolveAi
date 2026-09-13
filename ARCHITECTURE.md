# ARCHITECTURE.md — Technical Architecture & Design
**Project:** ResolveAI
**Status:** LOCKED — this is the binding technical contract, not a menu of options

> ⚠️ **TO ANY AI ASSISTANT READING THIS FILE:**
> Every decision in this document is final for the duration of this build. Do not swap frameworks, do not introduce a new database, do not restructure folders "for best practice," and do not add libraries not listed here without explicit human approval. If something in here seems suboptimal, say so and ask — do not just change it.

---

## 1. Locked Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | Next.js (TypeScript) | No other frontend framework. No separate SPA. |
| Styling | Tailwind CSS | No CSS-in-JS libraries, no Bootstrap, no MUI. |
| Backend / compute | Supabase Edge Functions | This is the *only* backend compute layer. No separate Express/Fastify server. |
| Database | Supabase Postgres | No other database, no local SQLite, no Mongo. |
| Auth (optional, minimal) | Supabase Auth | Only if truly needed; not required for MVP demo. |
| AI reasoning | Gemini API | Server-side only. This is the *only* LLM in the system — no multi-model, no agent frameworks (LangChain, CrewAI, etc.) unless explicitly approved. |
| Language | TypeScript everywhere | No plain JavaScript files in the application code. |

**Any deviation from this table requires explicit human sign-off before a single line of code is written against the new choice.**

---

## 2. High-Level Architecture

```
                 ┌─────────────────────┐
                 │      Next.js        │
                 │     Frontend        │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ Supabase Edge       │
                 │ Function            │
                 │  Agent Controller   │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │       Gemini        │
                 │   Agent Reasoning   │
                 └──────────┬──────────┘
                            │
                     Tool requests
                            │
          ┌─────────────────┼──────────────────┐
          │                 │                  │
          ▼                 ▼                  ▼
    Customer Tool      Order Tool        Policy Tool
          │                 │                  │
          └─────────────────┼──────────────────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │    Supabase     │
                  │    Postgres     │
                  └─────────────────┘
                            │
                            ▼
                      State changes
                            │
                            ▼
                       Verification
```

### Data flow rules (do not violate)

1. Frontend never talks to Supabase Postgres directly for case resolution — only through the Edge Function.
2. Gemini never receives direct database credentials and never emits SQL.
3. Gemini requests a **tool call by name**; the backend validates the request, executes a deterministic function, and returns only the result to Gemini.
4. Gemini decides the *next* step only after seeing the result of the previous tool call.
5. Every state-changing action (refund/replacement/cancellation) is written to `agent_actions` before being reported to the user as complete.

---

## 3. Database Schema (Supabase Postgres)

Six core tables + one action-log table. Do not add extra tables without checking this against PRD Section 6 (Out of Scope) first.

### `customers`
```sql
id             text primary key
name           text not null
email          text not null
customer_tier  text not null            -- e.g. 'standard' | 'premium'
created_at     timestamptz default now()
```

### `products`
```sql
id        text primary key
name      text not null
category  text not null
price     numeric not null
```

### `inventory`
```sql
product_id          text references products(id)
available_quantity  integer not null
warehouse           text not null
primary key (product_id, warehouse)
```

### `orders`
```sql
id             text primary key
customer_id    text references customers(id)
product_id     text references products(id)
status         text not null      -- 'placed' | 'shipped' | 'delivered' | 'cancelled'
order_date     date not null
delivery_date  date
price          numeric not null
```

### `policies`
```sql
id           text primary key
policy_type  text not null        -- e.g. 'damaged_item', 'cancellation'
rules        jsonb not null       -- structured rules, NOT free text for RAG
```

Example `rules` payload:
```json
{
  "replacement_allowed": true,
  "refund_allowed": true,
  "claim_window_days": 7
}
```

> Policies are stored as structured JSON and read deterministically by the policy tool. Do not implement this as vector search / RAG for the MVP (see PRD Section 6).

### `cases`
```sql
id                text primary key
customer_id       text references customers(id)
order_id          text references orders(id)
customer_message  text not null
status            text not null default 'open'   -- 'open' | 'in_progress' | 'resolved' | 'escalated'
resolution         jsonb                          -- final structured outcome
created_at        timestamptz default now()
```

### `agent_actions` (the action log — critical for the demo)
```sql
id          bigint generated always as identity primary key
case_id     text references cases(id)
step        integer not null            -- ordering within the case
tool        text not null               -- e.g. 'get_inventory', 'create_refund'
input       jsonb not null
output      jsonb not null
status      text not null               -- 'success' | 'blocked' | 'error'
timestamp   timestamptz default now()
```

**This table is not optional decoration.** It is the mechanism that proves the system is an autonomous agent rather than a single LLM call. The frontend's Agent Execution page renders directly from this table.

---

## 4. Agent Tools — Contracts

Backend functions only. Gemini never executes these directly; it requests them by name and the backend executes deterministically.

### Investigation tools (read-only)
```
get_customer(customer_id) → { id, name, email, customer_tier }
get_order(order_id) → { id, customer_id, product_id, status, order_date, delivery_date, price }
get_product(product_id) → { id, name, category, price }
get_inventory(product_id) → { product_id, available_quantity, warehouse }
get_policy(policy_type) → { id, policy_type, rules }
```

### Action tools (state-changing)
```
create_refund(order_id) → { order_id, refund_status: 'processed', amount }
create_replacement(order_id) → { order_id, replacement_status: 'created', new_order_id }
cancel_order(order_id) → { order_id, status: 'cancelled' }
create_return(order_id) → { order_id, return_status: 'created' }
```

> `create_return` is the permitted alternative when an order has already shipped (so it cannot be
> cancelled) but the cancellation policy allows a return. It requires `order.status = 'shipped'`,
> `return_allowed_after_shipping = true`, and the order to be inside `return_window_days`. The order
> is recorded as `'cancelled'` so `orders.status` stays within the enum in Section 3.

### Verification tool
```
verify_case(case_id) → { case_id, verified: boolean, checks: [...] }
```

Rules for tool implementation:
- Every action tool must **re-check its own preconditions** server-side before mutating state (never trust that Gemini already checked correctly).
- Every action tool writes a row to `agent_actions` with `status: 'success' | 'blocked' | 'error'`.
- `create_replacement` and `create_refund` must fail loudly (return `blocked`, not a fabricated success) if inventory/policy preconditions aren't actually met at execution time.

---

## 5. Primary API — Edge Function

### `POST /resolve-case`

**Input:**
```json
{
  "case_id": "CASE001",
  "customer_message": "My headphones arrived damaged. I want a replacement."
}
```

**Conceptual loop (implemented in the Edge Function, not the frontend):**
```
while case not resolved AND iteration_count < MAX_ITERATIONS:
    Gemini decides next action (tool name + args)
    backend validates the requested tool + args
    backend executes the tool deterministically
    backend writes result to agent_actions
    backend returns tool result to Gemini
    Gemini decides next step based on that result
```

- `MAX_ITERATIONS` must be a hard constant (e.g., 12–15). If exceeded, the case is automatically set to `escalated` with a logged reason — never left in an infinite loop.
- The Edge Function is the *only* place that talks to both Gemini and Supabase. The frontend only calls `/resolve-case` and then reads `cases` + `agent_actions` for display.

---

## 6. Secrets & Environment Variables

```
GEMINI_API_KEY        → server-side only (Supabase Edge Function secret)
SUPABASE_SERVICE_ROLE → server-side only, never shipped to the client
SUPABASE_URL          → can be public
SUPABASE_ANON_KEY     → public, read-limited via RLS if used
```

**Never** create a variable named `NEXT_PUBLIC_GEMINI_API_KEY` or any client-exposed equivalent. If you find yourself about to reference `process.env.GEMINI_API_KEY` inside a file under a client component or `pages/`/`app/` route that ships to the browser, stop — that is a violation of this architecture.

---

## 7. Folder Structure (indicative — keep close to this)

```
/app                      → Next.js app router pages
  /case                   → Page 1: customer case intake
  /execution/[caseId]     → Page 2: agent execution view
  /resolution/[caseId]    → Page 3: final resolution view
/lib
  /tools                  → one file per backend tool (get_customer.ts, create_refund.ts, ...)
  /agent                  → agent loop orchestration logic
  /supabase               → supabase client setup
/supabase
  /functions/resolve-case → the Edge Function entrypoint
  /migrations             → SQL schema migrations
/types                    → shared TypeScript types for DB rows and tool I/O
```

Do not restructure this without a stated reason tied to an actual blocker.

---

## 8. Non-Negotiable Design Principle

> **LLM reasoning + deterministic application logic.**

Gemini decides *what* to do next. The backend, and only the backend, decides *how* it's actually done, validates it, and mutates state. This separation is what keeps the demo controllable, debuggable, and trustworthy under judging. Any implementation that lets the model write SQL, call Supabase directly, or bypass a tool function is a violation of this architecture, full stop.
