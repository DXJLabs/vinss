"use client";

import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { ConversationEntry } from "@/components/room/conversation/types";
import { MessageBubble } from "@/components/room/conversation/MessageBubble";
import { ConversationActions } from "@/components/room/conversation/ConversationActions";
import { OfferCard } from "@/components/room/conversation/OfferCard";
import { ProofModal } from "@/components/room/conversation/ProofModal";
import {
  explorerUrl,
  shortAddress,
} from "@/components/room/conversation/chatFormat";
import { sameStarknetAddress } from "@/lib/privacy/participantKeys";
import {
  escrowCustodyExists,
  getEscrowFundedProof,
} from "@/lib/deal-room/escrow";

interface DirectConversationPanelProps {
  entries: ConversationEntry[];
  offerEntries: ConversationEntry[];
  walletAddress?: string;
  peerAddress: string;
  connected: boolean;
  channelReady: boolean;
  busy: boolean;
  draft: string;
  peerTyping: boolean;
  chatEndRef: MutableRefObject<HTMLDivElement | null>;
  onBack: () => void;
  onDraftChange: (value: string) => void;
  onSendMessage: () => void | Promise<void>;
  onSubmitWork: (input: {
    custodyCommitment: string;
    note: string;
    file?: File | null;
  }) => Promise<boolean>;
  onCreateOffer: () => void;
  onAddEscrow: () => void;
  onAcceptOffer: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onRejectOffer: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onCounterOffer: (
    entry: ConversationEntry,
  ) => void;
  onOpenEscrow: (
    entry: ConversationEntry,
  ) => void;
  onOfferRead: (
    entry: ConversationEntry,
  ) => void | Promise<void>;
}

async function sha256LocalFile(
  file: File,
): Promise<string> {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      await file.arrayBuffer(),
    );

  return (
    "0x" +
    Array.from(
      new Uint8Array(digest),
    )
      .map((value) =>
        value
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function DirectConversationPanel({
  entries,
  offerEntries,
  walletAddress,
  peerAddress,
  connected,
  channelReady,
  busy,
  draft,
  peerTyping,
  chatEndRef,
  onBack,
  onDraftChange,
  onSendMessage,
  onSubmitWork,
  onCreateOffer,
  onAddEscrow,
  onAcceptOffer,
  onRejectOffer,
  onCounterOffer,
  onOpenEscrow,
  onOfferRead,
}: DirectConversationPanelProps) {
  const [proofEntry, setProofEntry] =
    useState<ConversationEntry | null>(null);
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);
  const endNodeRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [
    fundedCustodies,
    setFundedCustodies,
  ] = useState<
    Record<string, true>
  >({});
  const [
    showWorkComposer,
    setShowWorkComposer,
  ] = useState(false);

  const [
    workNote,
    setWorkNote,
  ] = useState("");

  const [
    workFile,
    setWorkFile,
  ] = useState<File | null>(
    null,
  );

  const [
    workVerification,
    setWorkVerification,
  ] = useState<
    Record<
      string,
      "match" | "mismatch"
    >
  >({});

  const pairEntries = [
    ...entries,
    ...offerEntries,
  ]
    .filter((entry) => {
      if (
        (entry.scope ?? "group") !==
        "direct"
      ) {
        return false;
      }

      const incoming =
        sameStarknetAddress(
          entry.senderAddress,
          peerAddress,
        ) &&
        sameStarknetAddress(
          entry.recipientAddress,
          walletAddress,
        );

      const outgoing =
        sameStarknetAddress(
          entry.senderAddress,
          walletAddress,
        ) &&
        sameStarknetAddress(
          entry.recipientAddress,
          peerAddress,
        );

      return incoming || outgoing;
    })
    .sort(
      (left, right) =>
        new Date(left.sentAt).getTime() -
        new Date(right.sentAt).getTime(),
    );

  const canonicalCustodyKey = (
    value: string | null | undefined,
  ) => {
    if (
      typeof value !== "string" ||
      !value.trim()
    ) {
      return "";
    }

    try {
      return BigInt(value)
        .toString(16)
        .toLowerCase();
    } catch {
      return value
        .replace(/^0x/, "")
        .toLowerCase();
    }
  };

  function normalizeLocator(
    value: string | null | undefined,
  ): string {
    return typeof value === "string"
      ? value
          .replace(/^0x/, "")
          .toLowerCase()
      : "";
  }

  const preparedCustodies =
    pairEntries
      .filter(
        (entry) =>
          entry.offerAction?.kind ===
            "prepare_escrow" &&
          Boolean(
            entry.offerAction
              .custodyCommitment,
          ),
      )
      .map((entry) => ({
        key:
          canonicalCustodyKey(
            entry.offerAction!
              .custodyCommitment!,
          ),
        custodyCommitment:
          entry.offerAction!
            .custodyCommitment!,
      }));

  const preparedCustodyFingerprint =
    preparedCustodies
      .map((item) => item.key)
      .sort()
      .join("|");

  const fundedFreelanceEntry =
    [...pairEntries]
      .reverse()
      .find((entry) => {
        const action =
          entry.offerAction;

        if (
          action?.kind !==
            "prepare_escrow" ||
          action.dealType !==
            "freelance" ||
          !action.custodyCommitment
        ) {
          return false;
        }

        return Boolean(
          fundedCustodies[
            canonicalCustodyKey(
              action.custodyCommitment,
            )
          ],
        );
      });

  // Current freelance flow: the wallet that starts Rekber is the payer.
  // The counterparty becomes the work submitter after funding is confirmed.
  const canSubmitWork =
    Boolean(
      fundedFreelanceEntry,
    ) &&
    !sameStarknetAddress(
      fundedFreelanceEntry
        ?.offerAction
        ?.senderAddress,
      walletAddress,
    );

  useEffect(() => {
    if (!preparedCustodyFingerprint) {
      return;
    }

    let stopped = false;
    let running = false;

    const known =
      new Set(
        Object.keys(
          fundedCustodies,
        ),
      );

    const syncFundingStatus =
      async () => {
        if (
          stopped ||
          running
        ) {
          return;
        }

        running = true;

        try {
          const found:
            Record<string, true> = {};

          for (
            const item
            of preparedCustodies
          ) {
            if (
              known.has(
                item.key,
              )
            ) {
              continue;
            }

            const exists =
              await escrowCustodyExists(
                BigInt(
                  item.custodyCommitment,
                ),
              );

            if (
              stopped ||
              !exists
            ) {
              continue;
            }

            known.add(
              item.key,
            );
            found[item.key] =
              true;
          }

          if (
            !stopped &&
            Object.keys(found)
              .length > 0
          ) {
            setFundedCustodies(
              (previous) => ({
                ...previous,
                ...found,
              }),
            );
          }
        } catch (err) {
          console.debug(
            "[VINSS REKBER STATUS SYNC]",
            err,
          );
        } finally {
          running = false;
        }
      };

    // Cheap contract-state lookup. Do not scan historical events during chat load.
    void syncFundingStatus();

    const timer =
      window.setInterval(
        () =>
          void syncFundingStatus(),
        15_000,
      );

    const onVisible =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void syncFundingStatus();
        }
      };

    window.addEventListener(
      "focus",
      syncFundingStatus,
    );

    document.addEventListener(
      "visibilitychange",
      onVisible,
    );

    return () => {
      stopped = true;

      window.clearInterval(
        timer,
      );

      window.removeEventListener(
        "focus",
        syncFundingStatus,
      );

      document.removeEventListener(
        "visibilitychange",
        onVisible,
      );
    };
  }, [
    peerAddress,
    preparedCustodyFingerprint,
  ]);

  const preparedAgreementLocators =
    new Set(
      pairEntries
        .filter(
          (entry) =>
            entry.offerAction?.kind ===
              "prepare_escrow" &&
            Boolean(
              entry.offerAction
                .parentOfferLocator,
            ),
        )
        .map((entry) =>
          normalizeLocator(
            entry.offerAction
              ?.parentOfferLocator,
          ),
        ),
    );

  const supersededOfferLocators =
    new Set(
      pairEntries
        .filter(
          (entry) =>
            entry.kind === "offer" &&
            Boolean(
              entry.offerAction
                ?.parentOfferLocator,
            ),
        )
        .map((entry) =>
          normalizeLocator(
            entry.offerAction
              ?.parentOfferLocator,
          ),
        ),
    );

  const peerLabel =
    shortAddress(peerAddress);

  useEffect(() => {
    autoScrollRef.current = true;
    setShowJumpToLatest(false);
    chatEndRef.current = endNodeRef.current;

    const timer = window.setTimeout(() => {
      endNodeRef.current?.scrollIntoView({ block: "end" });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [peerAddress]);

  const updateScrollIntent = () => {
    const node = scrollBoxRef.current;
    if (!node) return;

    const distanceFromBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight;
    const nearBottom = distanceFromBottom < 96;

    autoScrollRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom);
    chatEndRef.current = nearBottom ? endNodeRef.current : null;
  };

  const jumpToLatest = () => {
    autoScrollRef.current = true;
    setShowJumpToLatest(false);
    chatEndRef.current = endNodeRef.current;
    endNodeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  };

  return (
    <>
      <div className="flex items-center gap-3 border-x border-b border-wire bg-vault/20 px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chats"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base text-paper/45 ring-1 ring-wire/60 transition hover:text-signal hover:ring-signal/25"
        >
          ←
        </button>

        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          title={peerAddress}
        >
          <p className="truncate text-[15px] font-medium text-paper/78">
            {peerLabel}
          </p>

          <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-paper/30">
            <span className="text-signal/65">🛡</span>
            <span>Encrypted</span>
          </p>
        </button>
      </div>

      <div className="relative">
        <div
          ref={scrollBoxRef}
          onScroll={updateScrollIntent}
          className="min-h-[360px] max-h-[58vh] overflow-y-auto overscroll-contain border-x border-wire/60 bg-black/10"
        >
        {pairEntries.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-signal/20 bg-signal/5">
              <span className="text-base text-signal">
                ✦
              </span>
            </div>

            <h3 className="font-display text-sm text-paper/70">
              Private chat
            </h3>

            <p className="mt-2 max-w-xs text-xs leading-relaxed text-paper/35">
              Only you and {peerLabel} can read messages and offers here.
            </p>
          </div>
        ) : (
          <ul className="space-y-4 p-4 sm:p-5">
            {pairEntries.map((entry) => {
              if (
                entry.kind ===
                  "message" &&
                entry.workEvidence
                  ?.type ===
                  "work_submission"
              ) {
                const evidence =
                  entry.workEvidence;

                const ownWork =
                  sameStarknetAddress(
                    entry.senderAddress,
                    walletAddress,
                  );

                const verification =
                  workVerification[
                    entry.actionLocator
                  ];

                return (
                  <li
                    key={`work:${entry.actionLocator}`}
                    className={
                      ownWork
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >
                    <div className="w-[88%] max-w-sm border border-amber-400/30 bg-amber-400/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-display text-[9px] uppercase tracking-[0.14em] text-amber-300">
                          Work submitted ✓
                        </span>

                        <span className="text-[9px] text-paper/25">
                          {ownWork
                            ? "You"
                            : "Counterparty"}
                        </span>
                      </div>

                      {evidence.note && (
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-paper/70">
                          {evidence.note}
                        </p>
                      )}

                      {evidence.fileName && (
                        <div className="mt-3 border border-wire bg-black/10 p-3">
                          <p className="break-all text-xs text-paper/65">
                            {evidence.fileName}
                          </p>

                          <p className="mt-1 text-[9px] text-paper/30">
                            {evidence.fileSize
                              ? `${(
                                  evidence.fileSize /
                                  1024
                                ).toFixed(1)} KB`
                              : "File"}
                            {" · "}
                            fingerprint encrypted
                          </p>

                          {evidence.fileSha256 && (
                            <>
                              <p className="mt-2 break-all font-mono text-[8px] text-paper/25">
                                {evidence.fileSha256}
                              </p>

                              <label className="mt-3 inline-flex cursor-pointer border border-signal/25 px-3 py-2 font-display text-[8px] uppercase tracking-[0.12em] text-signal/70 transition hover:bg-signal/10">
                                Verify local file
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={async (
                                    event,
                                  ) => {
                                    const file =
                                      event.target.files?.[0];

                                    if (!file) {
                                      return;
                                    }

                                    const hash =
                                      await sha256LocalFile(
                                        file,
                                      );

                                    setWorkVerification(
                                      (previous) => ({
                                        ...previous,
                                        [entry.actionLocator]:
                                          hash.toLowerCase() ===
                                          evidence.fileSha256!
                                            .toLowerCase()
                                            ? "match"
                                            : "mismatch",
                                      }),
                                    );

                                    event.target.value =
                                      "";
                                  }}
                                />
                              </label>

                              {verification && (
                                <p
                                  className={
                                    verification ===
                                    "match"
                                      ? "mt-2 text-[10px] text-signal"
                                      : "mt-2 text-[10px] text-danger"
                                  }
                                >
                                  {verification ===
                                  "match"
                                    ? "File verified ✓"
                                    : "File does not match this submission"}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between border-t border-wire/60 pt-3">
                        <span className="text-[9px] text-paper/30">
                          Encrypted evidence
                        </span>

                        {entry.transactionHash && (
                          <button
                            type="button"
                            onClick={() =>
                              setProofEntry(
                                entry,
                              )
                            }
                            className="font-display text-[8px] uppercase tracking-[0.12em] text-signal/65"
                          >
                            TX Proof ↗
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              }

              if (entry.kind === "message") {
                return (
                  <MessageBubble
                    key={`direct:${entry.actionLocator}`}
                    entry={entry}
                    walletAddress={
                      walletAddress
                    }
                    mode="direct"
                    onViewProof={
                      setProofEntry
                    }
                  />
                );
              }

              if (
                entry.offerAction?.kind ===
                  "prepare_escrow" &&
                entry.offerAction
                  .custodyCommitment
              ) {
                const custodyKey =
                  canonicalCustodyKey(
                    entry.offerAction
                      .custodyCommitment,
                  );

                const funded =
                  Boolean(
                    fundedCustodies[
                      custodyKey
                    ],
                  );

                const statusLabel =
                  funded
                    ? "Payment secured"
                    : "Rekber ready";

                const statusDetail =
                  funded
                    ? "Funds locked in VINSS Rekber"
                    : "Ready to secure payment";

                return (
                  <li
                    key={`rekber:${entry.actionLocator}`}
                    className="flex justify-center py-1"
                  >
                    <div className="w-full max-w-md rounded-2xl bg-signal/[0.035] px-3.5 py-3 ring-1 ring-signal/20">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-signal/[0.08] text-[10px] text-signal ring-1 ring-signal/20">
                            ✓
                          </span>

                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-signal/78">
                              {statusLabel}
                            </p>

                            <p className="mt-0.5 truncate text-[9px] text-paper/28">
                              {entry.offerAction.dealType
                                ?.replace(/_/g, " ") ??
                                "Deal"}
                              {" · "}
                              {statusDetail}
                            </p>
                          </div>
                        </div>

                        <p className="shrink-0 text-right text-[12px] font-medium text-paper/68">
                          {entry.offerAction.amount}{" "}
                          {entry.offerAction.asset}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center gap-4 border-t border-wire/45 pt-2.5">
                        {entry.transactionHash && (
                          <button
                            type="button"
                            onClick={() =>
                              setProofEntry(entry)
                            }
                            className="text-[9px] text-signal/55 transition hover:text-signal"
                          >
                            Agreement proof ↗
                          </button>
                        )}

                        {funded && (
                          <button
                            type="button"
                            onClick={async () => {
                              const proof =
                                await getEscrowFundedProof(
                                  BigInt(
                                    entry.offerAction!
                                      .custodyCommitment!,
                                  ),
                                );

                              if (!proof) {
                                return;
                              }

                              setProofEntry({
                                id:
                                  `rekber-funded:${custodyKey}`,
                                kind:
                                  "offer",
                                summary:
                                  `Payment secured — ${entry.offerAction!.amount} ${entry.offerAction!.asset}`,
                                transactionHash:
                                  proof.transactionHash,
                                actionLocator:
                                  `0x${custodyKey}`,
                                sentAt:
                                  proof.timestamp
                                    ? new Date(
                                        proof.timestamp *
                                          1000,
                                      ).toISOString()
                                    : entry.sentAt,
                                scope:
                                  "direct",
                                senderAddress:
                                  entry.senderAddress,
                                recipientAddress:
                                  entry.recipientAddress,
                              });
                            }}
                            className="text-[9px] text-signal/65 transition hover:text-signal"
                          >
                            Funding proof ↗
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              }

              const actionable =
                Boolean(
                  entry.offerAction &&
                    (entry.offerAction
                      .kind === "create" ||
                      entry.offerAction
                        .kind ===
                        "counter") &&
                    sameStarknetAddress(
                      entry.offerAction
                        .recipientAddress,
                      walletAddress,
                    ) &&
                    !supersededOfferLocators.has(
                      normalizeLocator(
                        entry.actionLocator,
                      ),
                    ),
                );

              return (
                <li
                  key={`offer:${entry.actionLocator}`}
                >
                  <OfferCard
                    entry={entry}
                    walletAddress={
                      walletAddress
                    }
                    busy={busy}
                    actionable={
                      actionable
                    }
                    rekberStarted={
                      entry.offerAction
                        ?.kind === "accept" &&
                      preparedAgreementLocators.has(
                        normalizeLocator(
                          entry.actionLocator,
                        ),
                      )
                    }
                    onAccept={
                      onAcceptOffer
                    }
                    onReject={
                      onRejectOffer
                    }
                    onCounter={
                      onCounterOffer
                    }
                    onOpenEscrow={
                      onOpenEscrow
                    }
                    onSeen={onOfferRead}
                    onViewProof={
                      setProofEntry
                    }
                  />

                </li>
              );
            })}

            <div
              ref={(node) => {
                endNodeRef.current = node;
                if (autoScrollRef.current) {
                  chatEndRef.current = node;
                }
              }}
              className="h-px"
              aria-hidden="true"
            />
          </ul>
        )}
        </div>

        {showJumpToLatest && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-3 right-3 border border-signal/30 bg-vault/95 px-3 py-2 font-display text-[8px] uppercase tracking-[0.12em] text-signal shadow-lg backdrop-blur"
          >
            ↓ Latest
          </button>
        )}
      </div>

      <ConversationActions
        connected={
          connected &&
          channelReady
        }
        busy={busy}
        onAddOffer={
          onCreateOffer
        }
        onAddEscrow={
          onAddEscrow
        }
        onSubmitWork={
          canSubmitWork
            ? () =>
                setShowWorkComposer(
                  (value) =>
                    !value,
                )
            : undefined
        }
      />

      <div className="bg-vault/12 p-2">
        {showWorkComposer &&
          canSubmitWork &&
          fundedFreelanceEntry
            ?.offerAction
            ?.custodyCommitment && (
          <div className="mb-2 border border-signal/25 bg-signal/[0.025] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-[9px] uppercase tracking-widest text-signal">
                Submit work evidence
              </span>

              <button
                type="button"
                onClick={() => {
                  setShowWorkComposer(
                    false,
                  );
                  setWorkNote("");
                  setWorkFile(null);
                }}
                className="text-xs text-paper/35"
              >
                ×
              </button>
            </div>

            <textarea
              value={workNote}
              onChange={(event) =>
                setWorkNote(
                  event.target.value,
                )
              }
              placeholder="Describe what was completed, link, delivery note…"
              rows={3}
              disabled={busy}
              className="mt-3 w-full resize-none border border-wire bg-transparent px-3 py-2 text-xs text-paper outline-none placeholder:text-paper/20 disabled:opacity-40"
            />

            <label className="mt-2 flex cursor-pointer items-center justify-between border border-wire px-3 py-2 text-[10px] text-paper/45">
              <span>
                {workFile
                  ? workFile.name
                  : "Choose proof file from this phone"}
              </span>

              <span className="font-display text-[8px] uppercase tracking-widest text-signal/65">
                Browse
              </span>

              <input
                type="file"
                className="hidden"
                disabled={busy}
                onChange={(event) =>
                  setWorkFile(
                    event.target
                      .files?.[0] ??
                      null,
                  )
                }
              />
            </label>

            {workFile && (
              <p className="mt-1 text-[9px] text-paper/25">
                File stays on this device. VINSS records only its encrypted fingerprint.
              </p>
            )}

            <button
              type="button"
              disabled={
                busy ||
                (!workNote.trim() &&
                  !workFile)
              }
              onClick={async () => {
                const submitted =
                  await onSubmitWork({
                    custodyCommitment:
                      fundedFreelanceEntry
                        .offerAction!
                        .custodyCommitment!,
                    note:
                      workNote,
                    file:
                      workFile,
                  });

                if (
                  submitted
                ) {
                  setShowWorkComposer(
                    false,
                  );
                  setWorkNote("");
                  setWorkFile(null);
                }
              }}
              className="mt-3 w-full border border-signal/35 px-3 py-2.5 font-display text-[9px] uppercase tracking-widest text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
            >
              {busy
                ? "Waiting for Ready X…"
                : "Submit Work →"}
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) =>
              onDraftChange(event.target.value)
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                void onSendMessage();
              }
            }}
            placeholder={`Message ${peerLabel}…`}
            rows={1}
            disabled={
              !connected ||
              !channelReady ||
              busy
            }
            className="min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/20 disabled:opacity-40"
          />

          <button
            type="button"
            onClick={() =>
              void onSendMessage()
            }
            disabled={
              !connected ||
              !channelReady ||
              busy ||
              !draft.trim()
            }
            className="h-11 border border-signal/35 px-4 font-display text-[9px] uppercase tracking-[0.14em] text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
          >
            Send
          </button>
        </div>
      </div>

      {proofEntry?.transactionHash && (
        <ProofModal
          kind={proofEntry.kind}
          transactionHash={
            proofEntry.transactionHash
          }
          recordId={
            proofEntry.actionLocator
          }
          explorerUrl={explorerUrl(
            proofEntry.transactionHash,
          )}
          onClose={() =>
            setProofEntry(null)
          }
        />
      )}
    </>
  );
}
