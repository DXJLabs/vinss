import type { AgentTimelineItem, DealContext } from "./tools.js";

type SafeActivityKind = "message" | "offer" | "escrow" | "activity";

const MAX_TIMELINE_ITEMS = 50;
const MAX_LOCATOR_LENGTH = 128;
const MAX_TIMESTAMP_LENGTH = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function safeKind(value: unknown): SafeActivityKind {
  if (value === "message" || value === "offer" || value === "escrow") {
    return value;
  }

  return "activity";
}

function safeSummary(kind: SafeActivityKind): string {
  switch (kind) {
    case "message":
      return "Encrypted private message";
    case "offer":
      return "Encrypted Offer action";
    case "escrow":
      return "Encrypted escrow action";
    default:
      return "Encrypted private activity";
  }
}

function sanitizeTimelineItem(value: unknown): AgentTimelineItem | null {
  if (!isRecord(value)) return null;

  const kind = safeKind(value.kind);
  const item: AgentTimelineItem = {
    kind,
    summary: safeSummary(kind),
  };

  const sentAt = boundedString(value.sentAt, MAX_TIMESTAMP_LENGTH);
  const actionLocator = boundedString(value.actionLocator, MAX_LOCATOR_LENGTH);

  if (sentAt) item.sentAt = sentAt;
  if (actionLocator) item.actionLocator = actionLocator;

  return item;
}

/**
 * Rebuilds remote Agent context from a privacy-safe allowlist.
 * Private plaintext, room labels, participant data, Offer terms, keys and
 * secrets are dropped even if a caller deliberately includes them.
 */
export function sanitizeAgentContext(value: unknown): DealContext {
  if (!isRecord(value)) return {};

  const context: DealContext = {};

  if (Array.isArray(value.timeline)) {
    const timeline = value.timeline
      .slice(-MAX_TIMELINE_ITEMS)
      .map(sanitizeTimelineItem)
      .filter((item): item is AgentTimelineItem => item !== null);

    if (timeline.length > 0) context.timeline = timeline;
  }

  if (isRecord(value.latestOffer)) {
    const actionLocator = boundedString(
      value.latestOffer.actionLocator,
      MAX_LOCATOR_LENGTH,
    );

    if (actionLocator) {
      context.latestOffer = { actionLocator };
    }
  }

  return context;
}
