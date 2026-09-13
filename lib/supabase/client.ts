import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase setup (ARCHITECTURE.md Section 6 and Section 7).
 *
 * SECURITY: this module reads SUPABASE_SERVICE_ROLE, which bypasses row-level security.
 * Import it from server code only (Edge Function, server component, route handler) —
 * never from a file marked "use client". No secret has a NEXT_PUBLIC_ variant.
 */

export type EnvVarName =
  | "SUPABASE_URL"
  | "SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE"
  | "GEMINI_API_KEY";

/** Presence check only. Callers may render this, never the value itself. */
export function isEnvConfigured(name: EnvVarName): boolean {
  return (process.env[name] ?? "").trim().length > 0;
}

function readSupabaseCredentials(): { url: string; serviceRoleKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE?.trim();
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/+$/, ""), serviceRoleKey };
}

/** The service-role client that later phases' tools and the agent loop talk to Postgres through. */
export function createServerSupabaseClient(): SupabaseClient {
  const credentials = readSupabaseCredentials();
  if (!credentials) {
    throw new Error(
      "Supabase is not configured: SUPABASE_URL and SUPABASE_SERVICE_ROLE must both be set server-side.",
    );
  }
  return createClient(credentials.url, credentials.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type SupabaseConnectionStatus = { connected: boolean; detail: string };

/** PostgREST codes meaning "connection works, but the schema isn't migrated yet". */
const SCHEMA_PENDING_CODES = ["PGRST205", "42P01"];

/**
 * Proves the app can actually reach Supabase with valid credentials.
 * Probes `customers` (ARCHITECTURE.md Section 3) so no extra endpoint is needed; a
 * "table not found" reply still proves connectivity, because it comes from Postgres.
 */
export async function checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  if (!readSupabaseCredentials()) {
    return {
      connected: false,
      detail: "SUPABASE_URL / SUPABASE_SERVICE_ROLE not set yet — add them to .env.local.",
    };
  }

  try {
    const { error } = await createServerSupabaseClient()
      .from("customers")
      .select("id")
      .limit(1);

    if (!error) {
      return { connected: true, detail: "Reached Postgres and queried customers." };
    }
    if (SCHEMA_PENDING_CODES.includes(error.code)) {
      return { connected: true, detail: "Reached Postgres; schema not migrated yet (Phase 1)." };
    }
    return { connected: false, detail: error.message };
  } catch (error) {
    return {
      connected: false,
      detail: error instanceof Error ? error.message : "Unknown connection error.",
    };
  }
}
