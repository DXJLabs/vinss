"use client";

import { useState } from "react";
import {
  askVinssAgent,
  type AgentProposal,
  type AgentTimelineItem,
  type DealStage,
} from "@/lib/agent";

function stageLabel(stage: DealStage | null) {
  switch (stage) {
    case "discussion":
      return "Diskusi";
    case "negotiating":
      return "Negosiasi";
    case "offer_pending":
      return "Offer menunggu";
    case "agreed":
      return "Disepakati";
    case "escrow_pending":
      return "Escrow menunggu";
    case "funded":
      return "Escrow terisi";
    case "rekber_pending":
      return "Settlement menunggu";
    case "completed":
      return "Selesai";
    default:
      return "Siap";
  }
}

function proposalLines(proposal: AgentProposal): string[] {
  switch (proposal.type) {
    case "draft_message":
      return [proposal.payload.body];

    case "draft_offer":
    case "draft_counter_offer":
      return [
        `${proposal.payload.amount} ${proposal.payload.asset}`,
        `Pembayaran: ${proposal.payload.paymentTerms}`,
        ...(proposal.payload.conditions
          ? [`Syarat: ${proposal.payload.conditions}`]
          : []),
      ];

    case "prepare_escrow":
      return [
        proposal.payload.dealOfferLocator
          ? `Offer: ${proposal.payload.dealOfferLocator}`
          : "Offer akan dipilih saat review",
        `Refund window: ${proposal.payload.refundHours ?? "24"} jam`,
      ];

    case "review_rekber":
      return [proposal.payload.reason];
  }
}

export function AgentPanel({
  roomLabel,
  timeline,
  latestOffer,
  onApproveProposal,
}: {
  roomLabel?: string;
  timeline: AgentTimelineItem[];
  latestOffer?: unknown;
  onApproveProposal?: (
    proposal: AgentProposal,
  ) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [shareContext, setShareContext] = useState(false);
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [dealStage, setDealStage] = useState<DealStage | null>(null);
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const [approved, setApproved] = useState(false);
  const [acted, setActed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!message.trim() || !shareContext) return;

    setBusy(true);
    setError(null);
    setAnswer(null);
    setProposal(null);
    setApproved(false);
    setActed(false);

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
      setDealStage(result.dealStage);
      setProposal(result.proposal);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "VINSS Agent tidak tersedia.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function approveProposal() {
    if (!proposal || approved) return;

    setError(null);
    setApproved(true);

    try {
      await onApproveProposal?.(proposal);
      setActed(true);
    } catch (err) {
      setApproved(false);
      setError(
        err instanceof Error
          ? err.message
          : "Proposal tidak dapat disiapkan.",
      );
    }
  }

  const steps = [
    { number: "01", label: "Amati", done: shareContext },
    {
      number: "02",
      label: "Analisis",
      done: Boolean(answer || proposal),
    },
    { number: "03", label: "Usulkan", done: Boolean(proposal) },
    { number: "04", label: "Setujui", done: approved },
    { number: "05", label: "Siapkan", done: acted },
  ];

  const activeStep = steps.findIndex((step) => !step.done);

  return (
    <section
      className="border border-wire bg-vault/60"
      data-testid="agent-panel"
    >
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-paper/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 rounded-full bg-signal" />

          <div>
            <div className="flex items-baseline">
              <span className="font-display text-xs uppercase tracking-widest text-signal">
                VINSS
              </span>
              <span className="ml-2 text-sm text-paper">
                Agent
              </span>
            </div>

            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-paper/35">
              Agen privat untuk seluruh proses deal
            </p>
          </div>
        </div>

        <span className="text-xs text-paper/40">
          {open ? "Tutup" : "Review deal →"}
        </span>
      </button>

      {open && (
        <div className="border-t border-wire">
          <div className="grid grid-cols-5 border-b border-wire text-center">
            {steps.map((step, index) => {
              const active =
                index === activeStep ||
                (activeStep === -1 && index === 4);

              return (
                <div
                  key={step.label}
                  className={`border-r border-wire px-1 py-3 last:border-r-0 ${
                    active ? "bg-paper/[0.025]" : ""
                  }`}
                >
                  <div className="font-display text-[9px] tracking-widest text-paper/25">
                    {step.number}
                  </div>

                  <div
                    className={`mt-1 text-[9px] uppercase tracking-wider ${
                      step.done || active
                        ? "text-signal"
                        : "text-paper/35"
                    }`}
                  >
                    {step.done ? "✓ " : ""}
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-5 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-[10px] uppercase tracking-widest text-paper/35">
                  Status deal
                </span>

                <span className="flex items-center gap-1.5 text-[10px] text-signal">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                  {stageLabel(dealStage)}
                </span>
              </div>

              <div className="border border-wire bg-paper/[0.015] p-3">
                <p className="text-sm text-paper/80">
                  {roomLabel || "Private Deal Room"}
                </p>

                <p className="mt-1 text-xs leading-relaxed text-paper/40">
                  Agent membantu memahami posisi deal dan menyiapkan
                  langkah berikutnya. Agent tidak memegang wallet atau
                  private key.
                </p>
              </div>
            </div>

            <div>
              <div className="mb-2 font-display text-[10px] uppercase tracking-widest text-paper/35">
                Batas konteks
              </div>

              <label className="flex cursor-pointer items-start gap-3 border border-wire p-3">
                <input
                  type="checkbox"
                  checked={shareContext}
                  onChange={(event) =>
                    setShareContext(event.target.checked)
                  }
                  className="mt-0.5"
                />

                <span>
                  <span className="block text-xs text-paper/75">
                    Izinkan Agent membaca konteks deal saat ini
                  </span>

                  <span className="mt-1 block text-[10px] leading-relaxed text-paper/35">
                    Hanya timeline, informasi room, dan offer yang
                    kamu izinkan yang dikirim untuk analisis.
                  </span>
                </span>
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-[10px] uppercase tracking-widest text-paper/35">
                  Instruksi
                </span>

                {!shareContext && (
                  <span className="text-[10px] text-paper/25">
                    Butuh izin konteks
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={(event) =>
                    setMessage(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void submit();
                    }
                  }}
                  placeholder="Contoh: Apa langkah terbaik untuk deal ini?"
                  disabled={!shareContext || busy}
                  className="min-w-0 flex-1 border border-wire bg-transparent px-3 py-2.5 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:opacity-40"
                />

                <button
                  onClick={() => void submit()}
                  disabled={
                    !shareContext ||
                    !message.trim() ||
                    busy
                  }
                  className="border border-signal px-4 py-2 font-display text-[10px] uppercase tracking-widest text-signal disabled:opacity-30"
                >
                  {busy ? "Analisis…" : "Jalankan"}
                </button>
              </div>
            </div>

            {answer && (
              <div className="border border-wire p-4">
                <p className="mb-2 font-display text-[10px] uppercase tracking-widest text-paper/35">
                  Analisis Agent
                </p>

                <p className="text-sm leading-relaxed text-paper/75">
                  {answer}
                </p>
              </div>
            )}

            {proposal && (
              <div className="border border-signal/40 bg-signal/[0.025] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-display text-[10px] uppercase tracking-widest text-signal">
                    Proposal Agent
                  </span>

                  <span className="text-[10px] uppercase tracking-wider text-paper/30">
                    Persetujuan wajib
                  </span>
                </div>

                <h4 className="text-sm text-paper">
                  {proposal.title}
                </h4>

                <p className="mt-1 text-xs leading-relaxed text-paper/40">
                  {proposal.description}
                </p>

                <div className="mt-3 space-y-1 border-l-2 border-signal pl-3">
                  {proposalLines(proposal).map((line) => (
                    <p
                      key={line}
                      className="text-xs text-paper/70"
                    >
                      {line}
                    </p>
                  ))}
                </div>

                {!acted ? (
                  <button
                    onClick={() =>
                      void approveProposal()
                    }
                    disabled={approved && !acted}
                    className="mt-4 w-full border border-signal px-4 py-3 font-display text-[10px] uppercase tracking-widest text-signal transition hover:bg-signal hover:text-ink disabled:opacity-40"
                  >
                    {approved
                      ? "Menyiapkan…"
                      : "Setujui & siapkan →"}
                  </button>
                ) : (
                  <div className="mt-4 border-t border-wire pt-3 text-xs text-signal">
                    ✓ Proposal sudah disiapkan di bagian deal yang sesuai.
                  </div>
                )}

                <p className="mt-3 text-[10px] leading-relaxed text-paper/30">
                  Persetujuan Agent tidak mengeksekusi transaksi.
                  Jika aksi membutuhkan blockchain, Ready X tetap
                  meminta konfirmasi wallet.
                </p>
              </div>
            )}

            {error && (
              <div className="border border-danger/30 p-3">
                <p className="text-xs text-danger">
                  {error}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
