import { Router, type Request, type Response } from "express";

export const presenceRouter = Router();

interface PresenceRecord {
  eventId: string;
  iv: string;
  ciphertext: string;
  createdAt: number;
  expiresAt: number;
}

const channels = new Map<string, PresenceRecord[]>();
const CHANNEL_ID = /^[a-f0-9]{64}$/;
const EVENT_ID = /^[A-Za-z0-9_-]{8,96}$/;
const MIN_TTL_MS = 1_000;
const MAX_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_EVENTS_PER_CHANNEL = 120;

function cleanChannel(channelId: string, now = Date.now()): PresenceRecord[] {
  const current = channels.get(channelId) ?? [];
  const live = current.filter((record) => record.expiresAt > now);

  if (live.length === 0) {
    channels.delete(channelId);
    return [];
  }

  channels.set(channelId, live);
  return live;
}

function validOpaqueString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maxLength
  );
}

// The backend stores only opaque encrypted envelopes. It never receives room
// keys, pairwise keys, wallet addresses, typing plaintext, or read plaintext.
presenceRouter.post("/presence/publish", (req: Request, res: Response) => {
  const { channelId, eventId, iv, ciphertext, ttlMs } = req.body as Record<
    string,
    unknown
  >;

  if (
    typeof channelId !== "string" ||
    !CHANNEL_ID.test(channelId) ||
    typeof eventId !== "string" ||
    !EVENT_ID.test(eventId) ||
    !validOpaqueString(iv, 128) ||
    !validOpaqueString(ciphertext, 16_384) ||
    typeof ttlMs !== "number" ||
    !Number.isFinite(ttlMs)
  ) {
    return res.status(400).json({
      error: "Invalid encrypted presence envelope.",
    });
  }

  const now = Date.now();
  const boundedTtl = Math.min(
    MAX_TTL_MS,
    Math.max(MIN_TTL_MS, Math.floor(ttlMs)),
  );
  const current = cleanChannel(channelId, now);

  if (!current.some((record) => record.eventId === eventId)) {
    current.push({
      eventId,
      iv,
      ciphertext,
      createdAt: now,
      expiresAt: now + boundedTtl,
    });
  }

  channels.set(
    channelId,
    current
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-MAX_EVENTS_PER_CHANNEL),
  );

  return res.status(204).end();
});

presenceRouter.post("/presence/poll", (req: Request, res: Response) => {
  const { channelId } = req.body as Record<string, unknown>;

  if (typeof channelId !== "string" || !CHANNEL_ID.test(channelId)) {
    return res.status(400).json({
      error: "Invalid presence channel.",
    });
  }

  return res.json({
    events: cleanChannel(channelId),
  });
});
