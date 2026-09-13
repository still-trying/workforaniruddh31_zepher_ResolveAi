-- ResolveAI demo seed data (ROADMAP.md Phase 2)
--
-- Deterministic: every value is fixed, and order dates are relative to current_date so the
-- 7-day damaged-item claim window stays meaningful whenever the demo is run, instead of
-- silently expiring after a hardcoded date.
--
-- Re-runnable: TESTING.md Section 2.3 requires each scenario to be re-run at least 3 times
-- from a clean seed, so this file truncates before inserting.

truncate table agent_actions, cases, orders, inventory, policies, products, customers
  restart identity cascade;

-- Customers -- 4 rows, mixed tiers
insert into customers (id, name, email, customer_tier) values
  ('CUST001', 'Ananya Rao',    'ananya.rao@example.com',    'standard'),
  ('CUST002', 'Marcus Chen',   'marcus.chen@example.com',   'premium'),
  ('CUST003', 'Priya Nair',    'priya.nair@example.com',    'standard'),
  ('CUST004', 'Diego Alvarez', 'diego.alvarez@example.com', 'premium');

-- Products -- 5 rows
insert into products (id, name, category, price) values
  ('PROD001', 'Wireless Headphones', 'Audio',     129.99),
  ('PROD002', 'Espresso Machine',    'Kitchen',   349.00),
  ('PROD003', 'Running Shoes',       'Footwear',   89.50),
  ('PROD004', 'Smart Watch',         'Wearables', 219.00),
  ('PROD005', 'Desk Lamp',           'Home',       45.00);

-- Inventory -- exactly one warehouse row per product, so get_inventory(product_id) can return
-- a single object as its contract in ARCHITECTURE.md Section 4 specifies.
-- PROD001 is deliberately 0: that is the blocked precondition for the flagship
-- replacement-unavailable-to-refund replan (PRD.md Section 8, scenario 2).
insert into inventory (product_id, available_quantity, warehouse) values
  ('PROD001',  0, 'WH-A'),
  ('PROD002', 12, 'WH-A'),
  ('PROD003',  7, 'WH-A'),
  ('PROD004',  4, 'WH-A'),
  ('PROD005', 25, 'WH-A');

-- Policies -- structured JSON rules read deterministically by get_policy. Not free text, and
-- deliberately not RAG (PRD.md Section 6).
insert into policies (id, policy_type, rules) values
  ('POL001', 'damaged_item',
   '{"replacement_allowed": true, "refund_allowed": true, "claim_window_days": 7}'::jsonb),
  ('POL002', 'cancellation',
   '{"cancellation_allowed": true, "cancellation_allowed_after_shipping": false, "return_allowed_after_shipping": true, "return_window_days": 14}'::jsonb),
  ('POL003', 'refund_approval',
   '{"refund_requires_approval": true, "approval_threshold": 200, "auto_refund_tiers": ["premium"]}'::jsonb);

-- Orders -- 6 rows across placed / shipped / delivered.
-- One order per case below, so no two seeded scenarios mutate the same order.
insert into orders (id, customer_id, product_id, status, order_date, delivery_date, price) values
  ('ORD001', 'CUST001', 'PROD001', 'delivered', current_date - 3,  current_date - 1,  129.99),
  ('ORD002', 'CUST002', 'PROD002', 'delivered', current_date - 5,  current_date - 2,  349.00),
  ('ORD003', 'CUST003', 'PROD003', 'shipped',   current_date - 2,  null,               89.50),
  ('ORD004', 'CUST004', 'PROD004', 'delivered', current_date - 4,  current_date - 2,  219.00),
  ('ORD005', 'CUST001', 'PROD005', 'delivered', current_date - 30, current_date - 26,  45.00),
  ('ORD006', 'CUST004', 'PROD002', 'placed',    current_date - 1,  null,              349.00);

-- Cases -- one per required demo scenario (PRD.md Section 8). All start 'open' with no
-- resolution; status transitions and the agent_actions trail are the agent's job in Phase 5.
insert into cases (id, customer_id, order_id, customer_message, status, resolution) values
  -- Scenario 1 -- successful replacement: policy allows it and PROD002 has 12 in stock.
  ('CASE001', 'CUST002', 'ORD002',
   'My espresso machine arrived damaged, the portafilter is cracked. I want a replacement.',
   'open', null),
  -- Scenario 2 -- FLAGSHIP replan: damaged headphones, policy allows replacement, but PROD001
  -- is out of stock, so the agent must detect the blocker and fall back to a refund.
  ('CASE002', 'CUST001', 'ORD001',
   'My headphones arrived damaged. I want a replacement.',
   'open', null),
  -- Scenario 3 -- cancellation blocked: ORD003 has already shipped and the cancellation policy
  -- disallows cancelling after shipping, so a permitted alternative is required.
  ('CASE003', 'CUST003', 'ORD003',
   'I need to cancel my running shoes order please.',
   'open', null),
  -- Scenario 4 -- refund approval path: 219.00 is above the 200 approval threshold, and
  -- CUST004 is premium, which the refund_approval policy auto-approves.
  ('CASE004', 'CUST004', 'ORD004',
   'The smart watch is not what I expected. I would like a refund.',
   'open', null),
  -- Scenario 5 -- second blocked path: delivered 26 days ago, so the 7-day claim window has
  -- expired and both replacement and refund are refused, leading to escalation.
  ('CASE005', 'CUST001', 'ORD005',
   'The desk lamp stopped working. I want a replacement or my money back.',
   'open', null);

-- ─────────────────────────────────────────────────────────────────────────────
-- CUSTOM DEMO CASE — "Flagship Replan: Damaged Laptop"
-- Premium customer ordered a Gaming Laptop. It arrived physically damaged.
-- They request a replacement. The agent checks inventory, finds stock = 0,
-- gets BLOCKED, then autonomously replans to issue a full refund of $1299.00
-- — all without human intervention.
-- ─────────────────────────────────────────────────────────────────────────────

-- Extra customer
insert into customers (id, name, email, customer_tier) values
  ('CUST005', 'Aniruddh Sharma', 'aniruddh.sharma@example.com', 'premium')
  on conflict (id) do update set name = excluded.name, email = excluded.email, customer_tier = excluded.customer_tier;

-- Extra product (high-value, makes the replan visually dramatic)
insert into products (id, name, category, price) values
  ('PROD006', 'Gaming Laptop', 'Electronics', 1299.00)
  on conflict (id) do update set name = excluded.name, category = excluded.category, price = excluded.price;

-- Inventory intentionally at 0 so the replacement is blocked and the agent must replan
insert into inventory (product_id, available_quantity, warehouse) values
  ('PROD006', 0, 'WH-B')
  on conflict (product_id) do update set available_quantity = excluded.available_quantity;

-- Order delivered yesterday so the 7-day claim window is still open
insert into orders (id, customer_id, product_id, status, order_date, delivery_date, price) values
  ('ORD007', 'CUST005', 'PROD006', 'delivered', current_date - 4, current_date - 1, 1299.00)
  on conflict (id) do update set status = excluded.status, delivery_date = excluded.delivery_date;

-- The case itself — starts open, agent will resolve it autonomously
insert into cases (id, customer_id, order_id, customer_message, status, resolution) values
  ('CASE006', 'CUST005', 'ORD007',
   'My brand-new Gaming Laptop arrived with a cracked screen and dented chassis. This is unacceptable for a $1299 purchase. I need an immediate replacement.',
   'open', null)
  on conflict (id) do update set status = 'open', resolution = null;
