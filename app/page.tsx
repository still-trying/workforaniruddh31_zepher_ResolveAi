import {
  checkSupabaseConnection,
  isEnvConfigured,
  type EnvVarName,
} from "@/lib/supabase/client";

export const dynamic = "force-dynamic";


export default async function Home() {
  const connection = await checkSupabaseConnection();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-8 py-16 font-sans bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md rounded-2xl border border-white/20 dark:border-zinc-800/50 shadow-xl mt-12 mb-12">
      <h1 className="text-3xl font-semibold tracking-tight">ResolveAI</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400 text-lg">
        An autonomous customer-resolution agent. Watch the agent investigate, act, verify, and dynamically replan when blocked—all without human intervention.
      </p>

      <div className="mt-8">
        <a 
          href="/case" 
          className="inline-block px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
        >
          Start Demo
        </a>
      </div>

    </main>
  );
}
