import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Connection details from the user
const dbUrl = `postgresql://postgres:98393aA@7aman@db.lcpzolixlhyfbqltrtpf.supabase.co:5432/postgres`;

async function runSql(filePath: string, description: string, client: Client) {
  const sql = readFileSync(filePath, "utf-8");
  console.log(`Running ${description}...`);

  try {
    await client.query(sql);
    console.log(`${description} completed`);
  } catch (error) {
    console.error(`Failed to run ${description}:`, error);
    throw error;
  }
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log("Connected to database");
    
    // Skip migrations since tables already exist, just run seed data
    await runSql(join(__dirname, "..", "supabase/seed.sql"), "seed data", client);
    
    console.log("Database setup complete!");
  } catch (error) {
    console.error("Database setup failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();