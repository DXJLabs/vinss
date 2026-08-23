"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  askVinssAgent,
  type AgentProposal,
  type AgentSkillId,
  type AgentTimelineItem,
  type DealStage,
} from "@/lib/agent";

export type AgentContextKind =
  | "messages"
  | "chat"
  | "group"
  | "deal"
  | "escrow";

interface AgentPanelProps {
  roomLabel?: string;
  contextKind: AgentContextKind;
  contextLabel: string;
  timeline: AgentTimelineItem[];
  latestOffer?: unknown;
  onApproveProposal?: (
    proposal: AgentProposal,
  ) => void | Promise<void>;
}

interface AgentCommand {
  label: string;
  prompt: string;
}

function skillForContext(
  contextKind: AgentContextKind,
): AgentSkillId {
  if (contextKind === "deal") {
    return "offer";
  }

  if (contextKind === "escrow") {
    return "escrow";
  }

  return "chat";
}

function stageLabel(
  stage: DealStage | null,
): string {
  switch (stage) {
    case "discussion":
      return "Discussion";
    case "negotiating":
      return "Negotiating";
    case "offer_pending":
      return "Offer pending";
    case "agreed":
      return "Agreed";
    case "escrow_pending":
      return "Escrow pending";
    case "funded":
      return "Funded";
    case "rekber_pending":
      return "Settlement pending";
    case "completed":
      return "Completed";
    default:
      return "Ready";
  }
}

function proposalLines(
  proposal: AgentProposal,
): string[] {
  switch (proposal.type) {
    case "draft_message":
      return [
        proposal.payload.body,
      ];

    case "draft_offer":
    case "draft_counter_offer":
      return [
        `${proposal.payload.amount} ${proposal.payload.asset}`,
        `Payment terms: ${proposal.payload.paymentTerms}`,
        ...(proposal.payload.conditions
          ? [
              `Conditions: ${proposal.payload.conditions}`,
            ]
          : []),
      ];

    case "prepare_escrow":
      return [
        proposal.payload
          .dealOfferLocator
          ? `Offer: ${proposal.payload.dealOfferLocator}`
          : "Offer will be selected during review",
        `Refund window: ${proposal.payload.refundHours ?? "24"} hours`,
      ];

    case "review_rekber":
      return [
        proposal.payload.reason,
      ];
  }
}

function commandsFor(
  contextKind: AgentContextKind,
): AgentCommand[] {
  switch (contextKind) {
    case "chat":
      return [
        {
          label: "Summarize chat",
          prompt:
            "Summarize this private chat and identify unresolved deal terms.",
        },
        {
          label: "Find next decision",
          prompt:
            "Identify the next decision both parties need to make based only on the shared context.",
        },
        {
          label: "Draft reply",
          prompt:
            "Draft a concise private reply that moves this deal forward without inventing facts.",
        },
        {
          label: "Review deal",
          prompt:
            "Review this private deal context and identify missing terms or risks.",
        },
      ];

    case "group":
      return [
        {
          label: "Summarize Group",
          prompt:
            "Summarize the current Group activity and list unresolved items.",
        },
        {
          label: "Find decisions",
          prompt:
            "Identify decisions in this Group that still need confirmation.",
        },
        {
          label: "Draft announcement",
          prompt:
            "Draft a concise Group message for the most useful next step.",
        },
        {
          label: "Review risks",
          prompt:
            "Review the shared Group context and identify practical deal risks.",
        },
      ];

    case "deal":
      return [
        {
          label: "Review offer",
          prompt:
            "Review the current offer and identify missing or risky terms.",
        },
        {
          label: "Suggest counter",
          prompt:
            "Suggest a practical counter-offer based only on the shared context.",
        },
        {
          label: "Explain next step",
          prompt:
            "Explain the current deal stage and the next required action.",
        },
        {
          label: "Prepare escrow",
          prompt:
            "Prepare escrow from the accepted offer only if the shared context supports it.",
        },
      ];

    case "escrow":
      return [
        {
          label: "Explain status",
          prompt:
            "Explain the current escrow state and the safest next step.",
        },
        {
          label: "Check readiness",
          prompt:
            "Identify what must be confirmed before funding, release, refund, or settlement.",
        },
        {
          label: "Review settlement",
          prompt:
            "Review whether the shared deal context is ready for settlement.",
        },
        {
          label: "Find risks",
          prompt:
            "List unresolved escrow or settlement risks from the shared context.",
        },
      ];

    default:
      return [
        {
          label: "Summarize activity",
          prompt:
            "Summarize the explicitly shared conversation activity.",
        },
        {
          label: "Find open items",
          prompt:
            "Identify unresolved deal items from the shared context.",
        },
        {
          label: "Draft next message",
          prompt:
            "Draft the next useful private message without inventing facts.",
        },
        {
          label: "Review deal stage",
          prompt:
            "Explain the current deal stage and the most useful next step.",
        },
      ];
  }
}


function cleanAgentText(
  value: string,
): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^---+$/gm, "")
    .replace(
      /\b([0-9a-fA-F]{20})[0-9a-fA-F]{18,}([0-9a-fA-F]{8})\b/g,
      "$1…$2",
    )
    .replace(
      /\n{3,}/g,
      "\n\n",
    )
    .trim();
}

function analysisWithoutProposal(
  answer: string,
  proposal: AgentProposal | null,
): string {
  let next = answer;

  if (proposal) {
    for (
      const line of proposalLines(
        proposal,
      )
    ) {
      if (line.trim()) {
        next = next.replace(
          line,
          "",
        );
      }
    }

    next = next.replace(
      /Draft private message\s*\([^)]*\)\s*:?\s*/gi,
      "",
    );
  }

  return cleanAgentText(next);
}

function AgentText({
  text,
}: {
  text: string;
}) {
  const cleaned =
    cleanAgentText(text);

  const lines =
    cleaned
      .split("\n")
      .map((line) =>
        line.trim(),
      )
      .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {lines.map(
        (line, index) => {
          const bullet =
            /^[-*]\s+/.test(
              line,
            );

          const content =
            line.replace(
              /^[-*]\s+/,
              "",
            );

          if (bullet) {
            return (
              <div
                key={`${index}:${content}`}
                className="flex items-start gap-2"
              >
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-signal/55" />

                <p className="min-w-0 break-words text-[12px] leading-5 text-paper/58 [overflow-wrap:anywhere]">
                  {content}
                </p>
              </div>
            );
          }

          return (
            <p
              key={`${index}:${content}`}
              className="break-words text-[12px] leading-5 text-paper/62 [overflow-wrap:anywhere]"
            >
              {content}
            </p>
          );
        },
      )}
    </div>
  );
}

export function AgentPanel({
  roomLabel,
  contextKind,
  contextLabel,
  timeline,
  latestOffer,
  onApproveProposal,
}: AgentPanelProps) {
  const [open, setOpen] =
    useState(false);

  const [
    shareContext,
    setShareContext,
  ] = useState(false);

  const [instruction, setInstruction] =
    useState("");

  const [answer, setAnswer] =
    useState<string | null>(null);

  const [
    dealStage,
    setDealStage,
  ] =
    useState<DealStage | null>(
      null,
    );

  const [proposal, setProposal] =
    useState<AgentProposal | null>(
      null,
    );

  const [approved, setApproved] =
    useState(false);

  const [acted, setActed] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const commands = useMemo(
    () =>
      commandsFor(contextKind),
    [contextKind],
  );

  useEffect(() => {
    // Context permission is scoped to the currently visible workflow.
    // Moving from one private chat or Group to another requires fresh consent.
    setShareContext(false);
    setInstruction("");
    setAnswer(null);
    setDealStage(null);
    setProposal(null);
    setApproved(false);
    setActed(false);
    setError(null);
  }, [
    contextKind,
    contextLabel,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      onKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        onKeyDown,
      );
    };
  }, [open]);

  useEffect(() => {
    const handleOpenAgent =
      () => setOpen(true);

    window.addEventListener(
      "vinss:open-agent",
      handleOpenAgent,
    );

    return () => {
      window.removeEventListener(
        "vinss:open-agent",
        handleOpenAgent,
      );
    };
  }, []);

  async function submit(
    override?: string,
  ) {
    const request =
      (override ?? instruction)
        .trim();

    if (
      !request ||
      !shareContext ||
      busy
    ) {
      return;
    }

    setInstruction(request);
    setBusy(true);
    setError(null);
    setAnswer(null);
    setProposal(null);
    setApproved(false);
    setActed(false);

    try {
      const result =
        await askVinssAgent({
          message: request,
          skill:
            skillForContext(
              contextKind,
            ),
          context: {
            roomLabel:
              roomLabel
                ? `${roomLabel} — ${contextLabel}`
                : contextLabel,
            latestOffer,
            timeline,
          },
        });

      setAnswer(result.answer);
      setDealStage(
        result.dealStage,
      );
      setProposal(
        result.proposal,
      );
    } catch (err) {
      console.error(
        "[VINSS AGENT ERROR]",
        err,
      );

      setError(
        "VINSS Agent is unavailable right now.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function approveProposal() {
    if (
      !proposal ||
      approved
    ) {
      return;
    }

    setError(null);
    setApproved(true);

    try {
      await onApproveProposal?.(
        proposal,
      );

      setActed(true);
    } catch (err) {
      console.error(
        "[VINSS AGENT PROPOSAL ERROR]",
        err,
      );

      setApproved(false);
      setError(
        "The proposed action could not be prepared.",
      );
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setOpen(true)
        }
        data-testid="agent-trigger"
        className="hidden"
      >
        <span className="text-sm text-signal">
          ✦
        </span>

        <span className="hidden font-display text-[9px] uppercase tracking-[0.16em] text-paper/70 sm:inline">
          Agent
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] sm:flex sm:items-end sm:justify-end sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="VINSS Agent"
          onMouseDown={(
            event,
          ) => {
            if (
              event.currentTarget ===
              event.target
            ) {
              setOpen(false);
            }
          }}
        >
          <section
            className="absolute inset-0 h-[100dvh] overflow-x-hidden overflow-y-auto border-0 bg-ink shadow-2xl sm:static sm:h-auto sm:max-h-[86vh] sm:w-full sm:max-w-md sm:rounded-2xl sm:border sm:border-wire/70"
            data-testid="agent-panel"
          >
            <header className="sticky top-0 z-10 border-b border-wire/55 bg-ink/95 px-4 pb-3 pt-2 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                  <span className="text-sm text-signal">
                    ✦
                  </span>

                  <p className="font-display text-[10px] uppercase tracking-[0.2em] text-signal">
                    VINSS Agent
                  </p>
                </div>

                  <p className="mt-1.5 truncate text-[10px] text-paper/32">
                    {contextLabel}
                  </p>
                </div>

              <button
                type="button"
                onClick={() =>
                  setOpen(false)
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-wire/65 bg-paper/[0.02] text-sm text-paper/40 transition hover:border-signal/40 hover:text-signal"
                aria-label="Close Agent"
              >
                ×
              </button>
              </div>
            </header>

            <div className="space-y-4 p-4 pb-7">
              <section>
                <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
                  <p className="font-display text-[9px] uppercase tracking-[0.16em] text-paper/35">
                    Context permission
                  </p>

                  <span
                    className={
                      shareContext
                        ? "font-display text-[8px] uppercase tracking-[0.13em] text-signal/70"
                        : "font-display text-[8px] uppercase tracking-[0.13em] text-paper/25"
                    }
                  >
                    {shareContext
                      ? "Allowed"
                      : "Not shared"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShareContext(
                      (value) =>
                        !value,
                    )
                  }
                  className={
                    shareContext
                      ? "flex w-full items-center gap-3 rounded-xl border border-signal/25 bg-signal/[0.035] px-3 py-3 text-left"
                      : "flex w-full items-center gap-3 rounded-xl border border-wire/65 bg-paper/[0.012] px-3 py-3 text-left transition hover:border-signal/30"
                  }
                >
                  <span
                    className={
                      shareContext
                        ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-signal bg-signal text-[9px] text-ink"
                        : "h-5 w-5 shrink-0 rounded-md border border-paper/25"
                    }
                  >
                    {shareContext
                      ? "✓"
                      : ""}
                  </span>

                  <span>
                    <span className="block text-[12px] font-medium text-paper/72">
                      Share safe context with Agent
                    </span>

                    <span className="mt-1 block text-[9px] leading-relaxed text-paper/28">
                      Private content stays on this device. Only privacy-safe workflow context and your instruction are sent.
                    </span>
                  </span>
                </button>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-display text-[9px] uppercase tracking-[0.16em] text-paper/34">
                    Quick actions
                  </p>

                  {!shareContext && (
                    <span className="text-[9px] text-paper/25">
                      Allow context first
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {commands.map(
                    (command) => (
                      <button
                        key={
                          command.label
                        }
                        type="button"
                        onClick={() =>
                          void submit(
                            command.prompt,
                          )
                        }
                        disabled={
                          !shareContext ||
                          busy
                        }
                        className="min-h-11 rounded-xl border border-wire/60 bg-paper/[0.015] px-3 py-2.5 text-left text-[11px] leading-snug text-paper/55 transition hover:border-signal/35 hover:bg-signal/[0.025] hover:text-signal disabled:cursor-not-allowed disabled:opacity-25"
                      >
                        {command.label}
                      </button>
                    ),
                  )}
                </div>
              </section>

              <section>
                <p className="mb-2 font-display text-[9px] uppercase tracking-[0.16em] text-paper/35">
                  Ask Agent
                </p>

                <textarea
                  value={instruction}
                  onChange={(event) =>
                    setInstruction(
                      event.target.value,
                    )
                  }
                  placeholder="Give the Agent a task for this context…"
                  rows={3}
                  disabled={
                    !shareContext ||
                    busy
                  }
                  className="min-h-[92px] w-full resize-none rounded-xl border border-wire/60 bg-paper/[0.012] px-3.5 py-3 text-sm leading-relaxed text-paper outline-none placeholder:text-paper/20 focus:border-signal/45 disabled:opacity-35"
                />

                <button
                  type="button"
                  onClick={() =>
                    void submit()
                  }
                  disabled={
                    !shareContext ||
                    !instruction.trim() ||
                    busy
                  }
                  className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border border-signal/30 bg-signal/[0.035] font-display text-[9px] uppercase tracking-[0.15em] text-signal transition hover:bg-signal hover:text-ink disabled:cursor-not-allowed disabled:opacity-25"
                >
                  {busy
                    ? "Working…"
                    : "Run Agent"}
                </button>
              </section>

              {(answer ||
                dealStage) && (
                <section className="overflow-hidden rounded-2xl border border-wire/55 bg-paper/[0.012] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-[8px] uppercase tracking-[0.18em] text-paper/32">
                      Analysis
                    </p>

                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-signal/[0.055] px-2.5 py-1 text-[9px] text-signal/75">
                      <span className="h-1.5 w-1.5 rounded-full bg-signal" />

                      {stageLabel(
                        dealStage,
                      )}
                    </span>
                  </div>

                  {answer && (
                    <div className="mt-3 border-t border-wire/45 pt-3">
                      <AgentText
                        text={analysisWithoutProposal(
                          answer,
                          proposal,
                        )}
                      />
                    </div>
                  )}
                </section>
              )}

              {proposal && (
                <section className="overflow-hidden rounded-2xl border border-signal/25 bg-signal/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-[8px] uppercase tracking-[0.18em] text-signal/80">
                      Proposed action
                    </p>

                    <span className="rounded-full border border-wire/55 px-2 py-1 font-display text-[7px] uppercase tracking-[0.12em] text-paper/28">
                      Approval required
                    </span>
                  </div>

                  <h3 className="mt-3 text-[15px] font-medium text-paper/82">
                    {proposal.title}
                  </h3>

                  <p className="mt-1 text-[11px] leading-5 text-paper/36">
                    {proposal.description}
                  </p>

                  <div className="mt-4 rounded-xl border border-wire/50 bg-ink/35 p-3.5">
                    <AgentText
                      text={proposalLines(
                        proposal,
                      ).join("\n")}
                    />
                  </div>

                  {!acted ? (
                    <button
                      type="button"
                      onClick={() =>
                        void approveProposal()
                      }
                      disabled={
                        approved &&
                        !acted
                      }
                      className="mt-4 flex h-11 w-full items-center justify-center rounded-xl border border-signal/35 bg-signal/[0.04] font-display text-[9px] uppercase tracking-[0.15em] text-signal transition hover:bg-signal hover:text-ink disabled:opacity-35"
                    >
                      {approved
                        ? "Preparing…"
                        : "Review & prepare →"}
                    </button>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-signal/[0.05] px-3 py-2.5 text-[11px] text-signal/75">
                      <span>✓</span>
                      <span>
                        Prepared in VINSS workflow
                      </span>
                    </div>
                  )}

                  <p className="mt-3 text-[9px] leading-4 text-paper/22">
                    Agent prepares the action. Your wallet remains the final approval for blockchain transactions.
                  </p>
                </section>
              )}

              {error && (
                <section className="rounded-xl border border-danger/25 bg-danger/[0.025] p-3">
                  <p className="text-xs text-danger">
                    {error}
                  </p>
                </section>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
