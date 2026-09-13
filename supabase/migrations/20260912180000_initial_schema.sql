-- ResolveAI initial schema
-- Source of truth: ARCHITECTURE.md Section 3 (LOCKED). Column names, types and keys match it
-- exactly and must not be renamed. Tables are created in dependency order so the foreign keys
-- resolve on a clean database.

create table customers (
  id             text primary key,
  name           text not null,
  email          text not null,
  customer_tier  text not null,
  created_at     timestamptz default now()
);

create table products (
  id        text primary key,
  name      text not null,
  category  text not null,
  price     numeric not null
);

create table inventory (
  product_id          text references products(id),
  available_quantity  integer not null,
  warehouse           text not null,
  primary key (product_id, warehouse)
);

create table orders (
  id             text primary key,
  customer_id    text references customers(id),
  product_id     text references products(id),
  status         text not null,
  order_date     date not null,
  delivery_date  date,
  price          numeric not null
);

create table policies (
  id           text primary key,
  policy_type  text not null,
  rules        jsonb not null
);

create table cases (
  id                text primary key,
  customer_id       text references customers(id),
  order_id          text references orders(id),
  customer_message  text not null,
  status            text not null default 'open',
  resolution        jsonb,
  created_at        timestamptz default now()
);

-- The action log that proves the system is an agent and not a single LLM call.
-- Rendered directly by the Agent Execution page (ARCHITECTURE.md Section 3).
create table agent_actions (
  id         bigint generated always as identity primary key,
  case_id    text references cases(id),
  step       integer not null,
  tool       text not null,
  input      jsonb not null,
  output     jsonb not null,
  status     text not null,
  timestamp  timestamptz default now()
);
