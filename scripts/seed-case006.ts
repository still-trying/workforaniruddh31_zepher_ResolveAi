/**
 * Injects CASE006 (and its supporting rows) directly into the live Supabase
 * project via the service-role key already stored in .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "..", ".env.local") });

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE!;
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const today = new Date();
const daysAgo = (n: number) =>
  new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10);

async function seed() {
  console.log("▶ Seeding CASE006 (Flagship Replan: Damaged Laptop)…");

  // 1 – Customer
  const { error: e1 } = await supabase.from("customers").upsert({
    id: "CUST005",
    name: "Aniruddh Sharma",
    email: "aniruddh.sharma@example.com",
    customer_tier: "premium",
  });
  if (e1) throw e1;
  console.log("  ✓ customers");

  // 2 – Product
  const { error: e2 } = await supabase.from("products").upsert({
    id: "PROD006",
    name: "Gaming Laptop",
    category: "Electronics",
    price: 1299.00,
  });
  if (e2) throw e2;
  console.log("  ✓ products");

  // 3 – Inventory (0 units — forces the replan)
  const { error: e3 } = await supabase.from("inventory").upsert({
    product_id: "PROD006",
    available_quantity: 0,
    warehouse: "WH-B",
  });
  if (e3) throw e3;
  console.log("  ✓ inventory (0 units → replacement will be blocked)");

  // 4 – Order (delivered yesterday, claim window open)
  const { error: e4 } = await supabase.from("orders").upsert({
    id: "ORD007",
    customer_id: "CUST005",
    product_id: "PROD006",
    status: "delivered",
    order_date: daysAgo(4),
    delivery_date: daysAgo(1),
    price: 1299.00,
  });
  if (e4) throw e4;
  console.log("  ✓ orders");

  // 5 – Case (open, ready for agent)
  await supabase.from("agent_actions").delete().eq("case_id", "CASE006");
  const { error: e5 } = await supabase.from("cases").upsert({
    id: "CASE006",
    customer_id: "CUST005",
    order_id: "ORD007",
    customer_message:
      "My brand-new Gaming Laptop arrived with a cracked screen and dented chassis. This is unacceptable for a $1299 purchase. I need an immediate replacement.",
    status: "open",
    resolution: null,
  });
  if (e5) throw e5;
  console.log("  ✓ cases");

  console.log("\n✅ CASE006 is ready! Open /case in the browser and select ⭐ Flagship Replan: Damaged Laptop.");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
