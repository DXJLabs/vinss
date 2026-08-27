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
  getRekberCustody,
} from "@/lib/deal-room/settlement";
import {
  REKBER_COORDINATION_VERSION,
} from "@/lib/deal-room/rekberAuthorization";
import type {
  DiscoveredEscrowAction,
} from "@/hooks/room/useRoomEscrow";
import type {
  AttachmentRef,
  DealType,
  WorkEvidence,
  WorkReviewDecision,
} from "@/types/deal-room";
import {
  EncryptedAttachmentPreview,
} from "@/components/room/conversation/EncryptedAttachmentPreview";
import { VINSS_FEES } from "@/lib/fees";
import { useStarkIdentity } from "@/hooks/useStarkIdentity";

interface EvidenceUiCopy {
  actionLabel: string;
  submittedLabel: string;
  composerTitle: string;
  placeholder: string;
  submitButton: string;
  approveButton: string;
  revisionButton: string;
  rejectButton: string;
}

function evidenceUiForDealType(
  dealType?: DealType,
): EvidenceUiCopy {
  switch (dealType) {
    case "freelance":
      return {
        actionLabel: "Submit work",
        submittedLabel: "Work submitted ✓",
        composerTitle: "Submit work evidence",
        placeholder:
          "Describe what was completed, delivery note, link…",
        submitButton: "Submit Work →",
        approveButton: "Approve work",
        revisionButton: "Request revision",
        rejectButton: "Reject",
      };

    case "bounty":
      return {
        actionLabel: "Submit result",
        submittedLabel: "Result submitted ✓",
        composerTitle: "Submit bounty result",
        placeholder:
          "Describe the completed result and supporting evidence…",
        submitButton: "Submit Result →",
        approveButton: "Approve result",
        revisionButton: "Request revision",
        rejectButton: "Reject",
      };

    case "digital_goods":
      return {
        actionLabel: "Deliver files",
        submittedLabel: "Delivery submitted ✓",
        composerTitle: "Deliver digital goods",
        placeholder:
          "Describe the delivered files, keys, links, or notes…",
        submitButton: "Deliver Files →",
        approveButton: "Accept delivery",
        revisionButton: "Request changes",
        rejectButton: "Reject delivery",
      };

    case "goods":
      return {
        actionLabel: "Delivery proof",
        submittedLabel: "Delivery evidence ✓",
        composerTitle: "Submit delivery evidence",
        placeholder:
          "Add tracking, handover, receipt, or delivery details…",
        submitButton: "Submit Evidence →",
        approveButton: "Confirm received",
        revisionButton: "Report issue",
        rejectButton: "Reject delivery",
      };

    default:
      return {
        actionLabel: "Submit evidence",
        submittedLabel: "Evidence submitted ✓",
        composerTitle: "Submit deal evidence",
        placeholder:
          "Describe the delivery or evidence for this deal…",
        submitButton: "Submit Evidence →",
        approveButton: "Approve",
        revisionButton: "Request changes",
        rejectButton: "Reject",
      };
  }
}

function supportsDealEvidence(
  dealType?: DealType,
): boolean {
  return (
    dealType !== "otc" &&
    dealType !== "nft"
  );
}

interface DirectConversationPanelProps {
  entries: ConversationEntry[];
  offerEntries: ConversationEntry[];
  escrowActions: DiscoveredEscrowAction[];
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
  onSendAttachment: (
    file: File,
    caption?: string,
  ) => Promise<boolean>;
  onLoadAttachment: (
    attachment: AttachmentRef,
  ) => Promise<Blob>;
  onSubmitWork: (input: {
    custodyCommitment: string;
    dealType?: DealType;
    note: string;
    file?: File | null;
  }) => Promise<boolean>;
  onReviewWork: (input: {
    custodyCommitment: string;
    submissionLocator: string;
    decision: WorkReviewDecision;
    note?: string;
  }) => Promise<boolean>;
  onOpenEscrowReview: () => void;
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
  escrowActions,
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
  onSendAttachment,
  onLoadAttachment,
  onSubmitWork,
  onReviewWork,
  onOpenEscrowReview,
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
  const attachmentInputRef =
    useRef<HTMLInputElement | null>(null);
  const messageInputRef =
    useRef<HTMLTextAreaElement | null>(null);
  const [messageInputFocused, setMessageInputFocused] =
    useState(false);
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

  const rekberCreateActions =
    escrowActions.filter((item) => {
      if (
        item.action.kind !== "create" ||
        item.action.coordinationVersion !==
          REKBER_COORDINATION_VERSION
      ) {
        return false;
      }

      const incoming =
        sameStarknetAddress(
          item.action.senderAddress,
          peerAddress,
        ) &&
        sameStarknetAddress(
          item.action.recipientAddress,
          walletAddress,
        );
      const outgoing =
        sameStarknetAddress(
          item.action.senderAddress,
          walletAddress,
        ) &&
        sameStarknetAddress(
          item.action.recipientAddress,
          peerAddress,
        );

      return incoming || outgoing;
    });

  const preparedCustodies =
    rekberCreateActions
      .filter((item) =>
        Boolean(
          item.action
            .custodyCommitment,
        ),
      )
      .map((item) => ({
        key: canonicalCustodyKey(
          item.action
            .custodyCommitment,
        ),
        custodyCommitment:
          item.action
            .custodyCommitment!,
      }));

  const preparedCustodyFingerprint =
    preparedCustodies
      .map((item) => item.key)
      .sort()
      .join("|");

  const fundedDealEntry =
    (():
      | ConversationEntry
      | null => {
      for (
        const item of [
          ...rekberCreateActions,
        ].reverse()
      ) {
        const custody =
          item.action
            .custodyCommitment;

        if (
          !custody ||
          !fundedCustodies[
            canonicalCustodyKey(
              custody,
            )
          ]
        ) {
          continue;
        }

        const termsEntry =
          pairEntries.find(
            (entry) =>
              normalizeLocator(
                entry.actionLocator,
              ) ===
              normalizeLocator(
                item.action
                  .dealOfferLocator,
              ),
          );

        if (!termsEntry?.offerAction) {
          continue;
        }

        return {
          ...termsEntry,
          offerAction: {
            ...termsEntry.offerAction,
            custodyCommitment:
              custody,
            senderAddress:
              item.action
                .senderAddress,
            recipientAddress:
              item.action
                .recipientAddress,
          },
        };
      }

      return null;
    })();

  const activeDealType =
    fundedDealEntry
      ?.offerAction
      ?.dealType;

  const evidenceUi =
    evidenceUiForDealType(
      activeDealType,
    );

  const currentPayerAddress =
    fundedDealEntry
      ?.offerAction
      ?.senderAddress;

  const currentCustody =
    fundedDealEntry
      ?.offerAction
      ?.custodyCommitment;

  const isCurrentPayer =
    sameStarknetAddress(
      currentPayerAddress,
      walletAddress,
    );

  const canSubmitWork =
    Boolean(
      fundedDealEntry &&
      supportsDealEvidence(
        activeDealType,
      ),
    ) &&
    !isCurrentPayer;

  const canReviewWork =
    Boolean(
      fundedDealEntry &&
      supportsDealEvidence(
        activeDealType,
      ),
    ) &&
    isCurrentPayer;

  const latestReviewBySubmission =
    new Map<
      string,
      Extract<
        WorkEvidence,
        {
          type: "work_review";
        }
      >
    >();

  for (const item of pairEntries) {
    const review =
      item.workEvidence;

    if (
      review?.type !==
      "work_review"
    ) {
      continue;
    }

    latestReviewBySubmission.set(
      normalizeLocator(
        review.submissionLocator,
      ),
      review,
    );
  }

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

            const exists = Boolean(
              await getRekberCustody(
                BigInt(
                  item.custodyCommitment,
                ),
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
        3000,
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
    new Set([
      ...rekberCreateActions.map(
        (item) =>
          normalizeLocator(
            item.action
              .dealOfferLocator,
          ),
      ),
    ]);

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

  const {
    label: peerLabel,
  } = useStarkIdentity(
    peerAddress,
  );

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

  const resizeMessageInput = () => {
    const node = messageInputRef.current;
    if (!node) return;

    node.style.height = "auto";
    node.style.height =
      `${Math.min(node.scrollHeight, 112)}px`;
  };

  useEffect(() => {
    resizeMessageInput();
  }, [draft]);

  async function sendComposerMessage() {
    if (!draft.trim() || busy) return;

    await onSendMessage();

    requestAnimationFrame(() => {
      resizeMessageInput();
      messageInputRef.current?.blur();
    });
  }

  return (
    <>
      <div className="relative z-30 flex items-center gap-3 border-x border-b border-wire bg-vault/20 px-3 py-3">
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
                  "work_review"
              ) {
                const review =
                  entry.workEvidence;

                const ownReview =
                  sameStarknetAddress(
                    entry.senderAddress,
                    walletAddress,
                  );

                const reviewTitle =
                  review.decision ===
                  "approved"
                    ? ownReview
                      ? "You approved the submission"
                      : activeDealType ===
                          "freelance"
                        ? "Work approved by employer"
                        : "Submission approved by payer"
                    : review.decision ===
                        "revision_requested"
                      ? ownReview
                        ? "You requested a revision"
                        : activeDealType ===
                            "freelance"
                          ? "Employer requested a revision"
                          : "Payer requested a revision"
                      : ownReview
                        ? "You rejected the submission"
                        : activeDealType ===
                            "freelance"
                          ? "Work rejected by employer"
                          : "Submission rejected by payer";

                return (
                  <li
                    key={`work-review:${entry.actionLocator}`}
                    className="flex justify-center"
                  >
                    <div className="w-[92%] max-w-sm border border-wire bg-black/15 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-display text-[8px] uppercase tracking-[0.12em] text-paper/35">
                          Work review
                        </p>

                        <span className="text-[8px] text-paper/25">
                          Encrypted
                        </span>
                      </div>

                      <p
                        className={
                          review.decision ===
                          "approved"
                            ? "mt-2 text-xs text-signal"
                            : review.decision ===
                                "revision_requested"
                              ? "mt-2 text-xs text-amber-300"
                              : "mt-2 text-xs text-danger"
                        }
                      >
                        {review.decision ===
                        "approved"
                          ? "✓ "
                          : review.decision ===
                              "revision_requested"
                            ? "↻ "
                            : "✕ "}
                        {reviewTitle}
                      </p>

                      {review.decision ===
                        "approved" && (
                        <p className="mt-1 text-[9px] leading-relaxed text-paper/35">
                          Work approval is complete. Payment settlement still needs to finish in Escrow.
                        </p>
                      )}

                      {review.note && (
                        <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-paper/55">
                          {review.note}
                        </p>
                      )}

                      {review.decision ===
                        "approved" &&
                        fundedDealEntry && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenEscrow(
                                fundedDealEntry,
                              )
                            }
                            className="mt-3 w-full border border-signal/35 px-3 py-2.5 font-display text-[8px] uppercase tracking-[0.12em] text-signal transition hover:bg-signal hover:text-ink"
                          >
                            {ownReview
                              ? "Continue settlement →"
                              : "Open Escrow for payment →"}
                          </button>
                        )}

                      {entry.transactionHash && (
                        <button
                          type="button"
                          onClick={() =>
                            setProofEntry(
                              entry,
                            )
                          }
                          className="mt-3 font-display text-[8px] uppercase tracking-[0.12em] text-signal/60"
                        >
                          TX Proof ↗
                        </button>
                      )}
                    </div>
                  </li>
                );
              }

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

                const entryUi =
                  evidenceUiForDealType(
                    evidence.dealType ??
                      activeDealType,
                  );

                const review =
                  latestReviewBySubmission.get(
                    normalizeLocator(
                      entry.actionLocator,
                    ),
                  );

                const matchesCurrentCustody =
                  canonicalCustodyKey(
                    evidence
                      .custodyCommitment,
                  ) ===
                  canonicalCustodyKey(
                    currentCustody,
                  );

                const submitReview =
                  async (
                    decision:
                      WorkReviewDecision,
                  ) => {
                    const sent =
                      await onReviewWork({
                        custodyCommitment:
                          evidence
                            .custodyCommitment,
                        submissionLocator:
                          entry.actionLocator,
                        decision,
                      });

                    if (
                      sent &&
                      decision ===
                        "approved"
                    ) {
                      if (fundedDealEntry) {
                        onOpenEscrow(
                          fundedDealEntry,
                        );
                      } else {
                        onOpenEscrowReview();
                      }
                    }
                  };

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
                          {entryUi.submittedLabel}
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

                      {entry.attachment && (
                        <div className="mt-3">
                          <EncryptedAttachmentPreview
                            attachment={
                              entry.attachment
                            }
                            onLoad={
                              onLoadAttachment
                            }
                          />
                        </div>
                      )}

                      {!entry.attachment &&
                        evidence.fileName && (
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

                      {review && (
                        <div className="mt-3 border border-wire bg-black/10 px-3 py-2.5">
                          <p className="font-display text-[8px] uppercase tracking-[0.12em] text-paper/35">
                            Review
                          </p>

                          <p
                            className={
                              review.decision ===
                              "approved"
                                ? "mt-1 text-[11px] text-signal"
                                : review.decision ===
                                    "revision_requested"
                                  ? "mt-1 text-[11px] text-amber-300"
                                  : "mt-1 text-[11px] text-danger"
                            }
                          >
                            {review.decision ===
                            "approved"
                              ? "Approved ✓ · settlement pending"
                              : review.decision ===
                                  "revision_requested"
                                ? "Revision requested"
                                : "Rejected"}
                          </p>

                          {review.decision ===
                            "approved" &&
                            fundedDealEntry && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenEscrow(
                                    fundedDealEntry,
                                  )
                                }
                                className="mt-2 w-full border border-signal/30 px-3 py-2 font-display text-[8px] uppercase tracking-[0.11em] text-signal transition hover:bg-signal hover:text-ink"
                              >
                                {isCurrentPayer
                                  ? "Continue settlement →"
                                  : "Open Escrow for payment →"}
                              </button>
                            )}
                        </div>
                      )}

                      {!ownWork &&
                        canReviewWork &&
                        matchesCurrentCustody &&
                        !review && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void submitReview(
                                  "revision_requested",
                                )
                              }
                              className="border border-amber-400/25 px-2 py-2 font-display text-[8px] uppercase tracking-[0.1em] text-amber-300 disabled:opacity-30"
                            >
                              {entryUi.revisionButton}
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void submitReview(
                                  "rejected",
                                )
                              }
                              className="border border-danger/30 px-2 py-2 font-display text-[8px] uppercase tracking-[0.1em] text-danger disabled:opacity-30"
                            >
                              {entryUi.rejectButton}
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void submitReview(
                                  "approved",
                                )
                              }
                              className="col-span-2 border border-signal/35 px-3 py-2.5 font-display text-[8px] uppercase tracking-[0.12em] text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
                            >
                              {entryUi.approveButton}
                            </button>
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
                    onLoadAttachment={
                      onLoadAttachment
                    }
                    onViewProof={
                      setProofEntry
                    }
                  />
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
                      (preparedAgreementLocators.has(
                        normalizeLocator(
                          entry.actionLocator,
                        ),
                      ) ||
                        preparedAgreementLocators.has(
                          normalizeLocator(
                            entry.offerAction
                              .parentOfferLocator,
                          ),
                        ))
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
        onAddFile={() =>
          attachmentInputRef.current?.click()
        }
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
        submitEvidenceLabel={
          evidenceUi.actionLabel
        }
      />

      <div className="border-x border-b border-wire/60 bg-vault/12 p-2">
        <input
          ref={attachmentInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.zip"
          disabled={!connected || !channelReady || busy}
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];

            if (!file) {
              return;
            }

            const caption = draft.trim();

            const sent =
              await onSendAttachment(
                file,
                caption,
              );

            if (sent && caption) {
              onDraftChange("");
            }

            input.value = "";
          }}
        />
        {showWorkComposer &&
          canSubmitWork &&
          fundedDealEntry
            ?.offerAction
            ?.custodyCommitment && (
          <div className="mb-2 border border-signal/25 bg-signal/[0.025] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-[9px] uppercase tracking-widest text-signal">
                {evidenceUi.composerTitle}
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
              placeholder={
                evidenceUi.placeholder
              }
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
                File is encrypted before upload and can be opened only by the two deal participants.
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
                      fundedDealEntry
                        .offerAction!
                        .custodyCommitment!,
                    dealType:
                      activeDealType,
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
                : evidenceUi.submitButton}
            </button>
          </div>
        )}

        <div className="mb-1 flex items-center justify-between gap-3 px-3 font-display text-[7px] uppercase tracking-[0.1em] text-paper/25">
          <span>
            VINSS fee · {VINSS_FEES.message.strk} STRK
          </span>
          <span>
            Pool/network fee shown in Ready X
          </span>
        </div>

        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            <textarea
              ref={messageInputRef}
              value={draft}
              onFocus={() =>
                setMessageInputFocused(true)
              }
              onBlur={() =>
                setMessageInputFocused(false)
              }
              onChange={(event) => {
                onDraftChange(event.target.value);
                requestAnimationFrame(
                  resizeMessageInput,
                );
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  void sendComposerMessage();
                }
              }}
              placeholder={`Message ${peerLabel}…`}
              rows={1}
              enterKeyHint="send"
              disabled={
                !connected ||
                !channelReady ||
                busy
              }
              className="max-h-28 min-h-11 w-full resize-none overflow-y-auto bg-transparent px-3 py-3 pr-10 text-sm leading-5 text-paper outline-none placeholder:text-paper/20 disabled:opacity-40"
            />

            {messageInputFocused && (
              <button
                type="button"
                aria-label="Close keyboard"
                onMouseDown={(event) =>
                  event.preventDefault()
                }
                onClick={() =>
                  messageInputRef.current?.blur()
                }
                className="absolute bottom-2.5 right-1 flex h-7 w-7 items-center justify-center rounded-lg text-xs text-paper/30 transition hover:bg-paper/5 hover:text-paper/60"
              >
                ↓
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              void sendComposerMessage()
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
