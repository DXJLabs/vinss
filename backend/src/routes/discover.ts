import { Router, type Request, type Response } from "express";
import {
  scanCommittedActions,
  fetchCiphertextChunks,
} from "../indexer/poolEvents.js";
import type { DiscoverKind, DiscoverRequest } from "../types.js";

export const discoverRouter = Router();

const VALID_KINDS: DiscoverKind[] = ["message", "offer", "escrow"];

discoverRouter.post("/discover", async (req: Request, res: Response) => {
  const body = req.body as Partial<DiscoverRequest>;

  // Privacy boundary: the discovery API is deliberately keyless. A channel
  // key must never cross the network to this backend.
  if ("channelKeyHex" in body) {
    return res.status(400).json({
      error: "channelKeyHex is not accepted. Discovery is ciphertext-only.",
    });
  }

  if (!body.kind || !VALID_KINDS.includes(body.kind)) {
    return res
      .status(400)
      .json({ error: `kind must be one of: ${VALID_KINDS.join(", ")}` });
  }

  try {
    const fromBlock = body.fromBlock ?? 0;
    const toBlock = body.toBlock ?? "latest";

    const committed = await scanCommittedActions(
      body.kind,
      fromBlock,
      toBlock,
    );

    // The backend only indexes public blockchain data and returns the
    // encrypted payload. It never receives a channel key and never decrypts.
    const records = await Promise.all(
      committed.map(async (action) => {
        const ciphertextChunks = await fetchCiphertextChunks(
          body.kind as DiscoverKind,
          action.actionLocator,
        );

        return {
          actionLocator: action.actionLocator,
          payloadCommitment: action.payloadCommitment,
          ciphertextChunks: ciphertextChunks.map(String),
          blockNumber: action.blockNumber,
          transactionHash: action.transactionHash,
        };
      }),
    );

    return res.json(records);
  } catch (err) {
    console.error(
      "[discover] error:",
      err instanceof Error ? err.message : err,
    );
    return res.status(500).json({ error: "Discovery failed. See server logs." });
  }
});
