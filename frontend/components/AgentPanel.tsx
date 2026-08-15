"use client";

import { useState } from "react";
import { askVinssAgent, type AgentTimelineItem } from "@/lib/agent";

export function AgentPanel({
  roomLabel,
  timeline,
  latestOffer,
}: {
  roomLabel?: string;
  timeline: AgentTimelineItem[];
  latestOffer?: unknown;
}) {
  const [open, setOpen] = useState(false);
  const [shareContext, setShareContext] = useState(false);
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!message.trim() || !shareContext) return;

    setBusy(true);
    setError(null);

    try {
      const result = await askVinssAgent({
        message: message.trim(),
        context: {
          roomLabel,
          latestOffer,
          timeline,
        },
      });

      setAnswer(result.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent tidak tersedia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="border border-wire bg-vault/60"
      data-testid="agent-panel"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-paper/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 rounded-full bg-signal shadow-[0_0_8px_rgba(255,255,255,0.35)]" />

          <div>
            <div className="flex items-baseline">
              <span className="font-display text-xs uppercase tracking-widest text-signal">
                VINSS
              </span>
              <span className="ml-2 text-sm text-paper">Agent</span>
            </div>

            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-paper/35">
              Your private deal agent
            </p>
          </div>
        </div>

        <span className="text-xs text-paper/40">
          {open ? "Close" : "Review deal →"}
        </span>
      </button>

      {open && (
        <div className="border-t border-wire">
          {/* Agent state */}
          <div className="grid grid-cols-5 border-b border-wire text-center">
            {[
              ["01", "Observe"],
              ["02", "Reason"],
              ["03", "Propose"],
              ["04", "Approve"],
              ["05", "Act"],
            ].map(([number, label], index) => (
              <div
                key={label}
                className={`border-r border-wire px-1 py-3 last:border-r-0 ${
                  index === 0 ? "bg-paper/[0.025]" : ""
                }`}
              >
                <div className="font-display text-[9px] tracking-widest text-paper/25">
                  {number}
                </div>
                <div
                  className={`mt-1 text-[9px] uppercase tracking-wider ${
                    index === 0 ? "text-signal" : "text-paper/35"
                  }`}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-5 p-4">
            {/* Current state */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-[10px] uppercase tracking-widest text-paper/35">
                  Current state
                </span>

                <span className="flex items-center gap-1.5 text-[10px] text-signal">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                  Ready
                </span>
              </div>

              <div className="border border-wire bg-paper/[0.015] p-3">
                <p className="text-sm text-paper/80">
                  {roomLabel || "Deal room"}
                </p>

                <p className="mt-1 text-xs leading-relaxed text-paper/40">
                  VINSS Agent can observe the deal context you explicitly
                  authorize and help analyze the current negotiation.
                </p>
              </div>
            </div>

            {/* Context boundary */}
            <div>
              <div className="mb-2 font-display text-[10px] uppercase tracking-widest text-paper/35">
                Context boundary
              </div>

              <label className="flex cursor-pointer items-start gap-3 border border-wire p-3 transition-colors hover:bg-paper/[0.02]">
                <input
                  type="checkbox"
                  checked={shareContext}
                  onChange={(e) => setShareContext(e.target.checked)}
                  className="mt-0.5"
                />

                <span>
                  <span className="block text-xs text-paper/75">
                    Share current deal context
                  </span>

                  <span className="mt-1 block text-[10px] leading-relaxed text-paper/35">
                    Timeline, room information and the latest offer may be
                    provided to VINSS Agent for analysis.
                  </span>
                </span>
              </label>
            </div>

            {/* Activity */}
            <div>
              <div className="mb-2 font-display text-[10px] uppercase tracking-widest text-paper/35">
                Activity
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-paper/45">
                  <span className="text-signal">✓</span>
                  Deal context available
                </div>

                <div className="flex items-center gap-2 text-paper/45">
                  <span className="text-paper/25">○</span>
                  Awaiting your instruction
                </div>

                <div className="flex items-center gap-2 text-paper/30">
                  <span>○</span>
                  No transaction will be executed automatically
                </div>
              </div>
            </div>

            {/* Ask / proposal */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-[10px] uppercase tracking-widest text-paper/35">
                  Agent instruction
                </span>

                {!shareContext && (
                  <span className="text-[10px] text-paper/25">
                    Context required
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  placeholder="Analyze the current deal…"
                  disabled={!shareContext || busy}
                  className="min-w-0 flex-1 border border-wire bg-transparent px-3 py-2.5 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
                />

                <button
                  onClick={submit}
                  disabled={!shareContext || !message.trim() || busy}
                  className="border border-signal px-4 py-2 font-display text-[10px] uppercase tracking-widest text-signal transition-colors hover:bg-signal hover:text-vault disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {busy ? "Thinking" : "Run"}
                </button>
              </div>
            </div>

            {/* Proposal */}
            {answer && (
              <div className="border border-signal/40 bg-signal/[0.025] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-display text-[10px] uppercase tracking-widest text-signal">
                    Agent proposal
                  </span>

                  <span className="text-[10px] uppercase tracking-wider text-paper/30">
                    Review required
                  </span>
                </div>

                <div
                  className="border-l-2 border-signal pl-3 text-sm leading-relaxed text-paper/80"
                  data-testid="agent-answer"
                >
                  {answer}
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-wire pt-3">
                  <span className="text-[10px] text-paper/35">
                    Agent cannot sign or send transactions.
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="border border-danger/30 bg-danger/[0.03] p-3">
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}

            {/* Safety boundary */}
            <div className="border-t border-wire pt-3">
              <p className="text-[10px] leading-relaxed text-paper/25">
                VINSS Agent analyzes and prepares recommendations. Financial
                actions remain under your explicit control.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
