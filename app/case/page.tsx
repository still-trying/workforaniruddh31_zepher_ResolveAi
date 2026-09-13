"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_SCENARIOS = [
  {
    id: "CASE006",
    title: "⭐ Flagship Replan: Damaged Laptop",
    description: "Premium customer's $1299 Gaming Laptop arrived with cracked screen. Agent tries replacement → BLOCKED (0 in stock) → autonomously replans to full refund",
    message: "My brand-new Gaming Laptop arrived with a cracked screen and dented chassis. This is unacceptable for a $1299 purchase. I need an immediate replacement.",
  },
  {
    id: "CASE001",
    title: "Successful Replacement",
    description: "Damaged espresso machine, policy allows replacement, inventory available",
    message: "My espresso machine arrived damaged, the portafilter is cracked. I want a replacement.",
  },
  {
    id: "CASE002",
    title: "Replacement Unavailable → Refund (Flagship Replan)",
    description: "Damaged headphones, policy allows replacement, but inventory is zero → agent replans to refund",
    message: "My headphones arrived damaged. I want a replacement.",
  },
  {
    id: "CASE003",
    title: "Cancellation Blocked → Alternative",
    description: "Customer requests cancellation, order already shipped → agent finds return alternative",
    message: "I need to cancel my running shoes order please.",
  },
  {
    id: "CASE004",
    title: "Refund Approval (Premium Auto-approve)",
    description: "Smart watch refund request, amount above threshold but customer is premium → auto-approved",
    message: "The smart watch is not what I expected. I would like a refund.",
  },
  {
    id: "CASE005",
    title: "Claim Window Expired → Escalation",
    description: "Desk lamp issue reported 26 days after delivery, outside 7-day window → escalation",
    message: "The desk lamp stopped working. I want a replacement or my money back.",
  },
];

export default function CasePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"demo" | "custom">("demo");
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [customMessage, setCustomMessage] = useState("");
  const [customCustomerId, setCustomCustomerId] = useState("");
  const [customOrderId, setCustomOrderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDemoSelect = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let caseId: string;
      let customerMessage: string;
      let casePayload: any;

      if (mode === "demo" && selectedScenario) {
        const scenario = DEMO_SCENARIOS.find(s => s.id === selectedScenario);
        if (!scenario) throw new Error("Invalid scenario");
        caseId = scenario.id;
        customerMessage = scenario.message;
        casePayload = { case_id: caseId, customer_message: customerMessage };
      } else if (mode === "custom") {
        if (!customMessage.trim()) throw new Error("Please enter a message");
        if (!customCustomerId.trim()) throw new Error("Please enter a Customer ID");
        if (!customOrderId.trim()) throw new Error("Please enter an Order ID");
        caseId = `CUSTOM-${Date.now()}`;
        customerMessage = customMessage;
        casePayload = {
          case_id: caseId,
          customer_message: customerMessage,
          customer_id: customCustomerId.trim(),
          order_id: customOrderId.trim()
        };
      } else {
        throw new Error("Please select a scenario or enter a custom message");
      }

      // Call the agent loop endpoint
      const response = await fetch("/api/resolve-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(casePayload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to start resolution");
      }

      const result = await response.json();
      setSuccess(`Case ${caseId} ${result.status}. Redirecting to execution view...`);
      
      // Redirect to execution page
      setTimeout(() => {
        router.push(`/execution/${caseId}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit case");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <header className="border-b border-white/20 dark:border-zinc-800/50 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <h1 className="text-2xl font-semibold">ResolveAI</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Autonomous customer-resolution agent. Submit a case to watch the agent investigate, act, verify, and replan.
          </p>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-3xl px-6 py-12 w-full">
        <div className="space-y-8">
          {/* Mode Selector */}
          <div className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md rounded-2xl border border-white/20 dark:border-zinc-800/50 p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">How would you like to proceed?</h2>
            <div className="flex gap-4">
              <button
                onClick={() => { setMode("demo"); setSelectedScenario(""); }}
                className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                  mode === "demo"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                }`}
              >
                <span className="block font-semibold">Demo Scenarios</span>
                <span className="text-sm text-zinc-500 mt-1">Pre-configured cases that demonstrate all agent behaviors</span>
              </button>
              <button
                onClick={() => { setMode("custom"); setSelectedScenario(""); }}
                className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                  mode === "custom"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                }`}
              >
                <span className="block font-semibold">Custom Case</span>
                <span className="text-sm text-zinc-500 mt-1">Enter your own customer issue</span>
              </button>
            </div>
          </div>

          {/* Demo Scenarios */}
          {mode === "demo" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Select a Demo Scenario</h2>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                Each scenario demonstrates a specific agent behavior. Click to select, then submit to watch the agent work.
              </p>
              <div className="grid gap-4">
                {DEMO_SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => handleDemoSelect(scenario.id)}
                    className={`text-left p-6 rounded-lg border-2 transition-all ${
                      selectedScenario === scenario.id
                        ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-900/40 backdrop-blur-sm"
                        : "border-white/20 dark:border-zinc-700/50 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm hover:bg-white/60 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{scenario.title}</h3>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{scenario.description}</p>
                        <p className="mt-2 text-sm font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 p-2 rounded">
                          {"\""}{scenario.message}{"\""}
                        </p>
                      </div>
                      {selectedScenario === scenario.id && (
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Case */}
          {mode === "custom" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Enter Custom Case</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Customer ID</label>
                    <input
                      type="text"
                      value={customCustomerId}
                      onChange={(e) => setCustomCustomerId(e.target.value)}
                      placeholder="e.g. CUST001"
                      className="w-full p-3 border border-white/30 dark:border-zinc-700/50 rounded-xl bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Order ID</label>
                    <input
                      type="text"
                      value={customOrderId}
                      onChange={(e) => setCustomOrderId(e.target.value)}
                      placeholder="e.g. ORD001"
                      className="w-full p-3 border border-white/30 dark:border-zinc-700/50 rounded-xl bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Customer Message</label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Describe the customer issue..."
                    className="w-full min-h-[120px] p-4 border border-white/30 dark:border-zinc-700/50 rounded-xl bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    rows={5}
                  />
                  <p className="mt-2 text-sm text-zinc-500">
                    Provide IDs from the database (e.g. CUST001, CUST002) so the agent can look up the correct records.
                  </p>
                </div>
              </form>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4">
            <button
              onClick={handleSubmit}
              disabled={submitting || (mode === "demo" && !selectedScenario) || (mode === "custom" && !customMessage.trim())}
              className="w-full py-4 px-6 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Starting Resolution..." : mode === "demo" ? "Start Resolution" : "Submit Custom Case"}
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300 animate-pulse">
              {success}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}