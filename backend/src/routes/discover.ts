import { Router, type Request, type Response } from "express";

import type {
  DiscoverKind,
  DiscoverRequest,
} from "../types.js";
import {
  getIndexerDefinition,
  type IndexerDefinition,
} from "../indexer/definitions.js";
import { DiscoveryStore } from "../indexer/store.js";

const VALID_KINDS: readonly DiscoverKind[] = [
  "message",
  "offer",
  "escrow",
];

const ALLOWED_DISCOVERY_FIELDS = new Set([
  "kind",
  "fromBlock",
  "toBlock",
]);

const FORBIDDEN_DISCOVERY_FIELDS = new Set([
  "roomId",
  "roomSecret",
  "channelKey",
  "channelKeyHex",
  "viewingKey",
  "viewingKeyHex",
  "decryptionKey",
  "plaintext",
]);

interface ValidDiscoverRequest {
  kind: DiscoverKind;
  fromBlock: number;
  toBlock: number | "latest";
}

function isDiscoverKind(value: unknown): value is DiscoverKind {
  return VALID_KINDS.includes(value as DiscoverKind);
}

function containsForbiddenField(
  body: Record<string, unknown>,
): string | null {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_DISCOVERY_FIELDS.has(key)) {
      return key;
    }
  }

  return null;
}

function findUnexpectedField(
  body: Record<string, unknown>,
): string | null {
  for (const key of Object.keys(body)) {
    if (!ALLOWED_DISCOVERY_FIELDS.has(key)) {
      return key;
    }
  }

  return null;
}

function parseBlockNumber(
  value: unknown,
  name: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return value;
}

function validateDiscoverRequest(
  value: unknown,
): ValidDiscoverRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request body must be an object.");
  }

  const body = value as Record<string, unknown>;
  const forbiddenField = containsForbiddenField(body);

  if (forbiddenField) {
    throw new Error(
      `${forbiddenField} is not accepted by ciphertext discovery.`,
    );
  }

  const unexpectedField = findUnexpectedField(body);

  if (unexpectedField) {
    throw new Error(
      `${unexpectedField} is not a supported discovery field.`,
    );
  }

  if (!isDiscoverKind(body.kind)) {
    throw new Error(
      `kind must be one of: ${VALID_KINDS.join(", ")}`,
    );
  }

  const fromBlock =
    body.fromBlock === undefined
      ? 0
      : parseBlockNumber(body.fromBlock, "fromBlock");

  let toBlock: number | "latest" = "latest";

  if (body.toBlock !== undefined && body.toBlock !== "latest") {
    const parsed = parseBlockNumber(body.toBlock, "toBlock");

    if (parsed < fromBlock) {
      throw new Error("toBlock must be >= fromBlock.");
    }

    toBlock = parsed;
  }

  return {
    kind: body.kind,
    fromBlock,
    toBlock,
  };
}

export function createDiscoverRouter(
  store: DiscoveryStore,
  definitions: readonly IndexerDefinition[],
): Router {
  const router = Router();

  router.post(
    "/discover",
    async (req: Request, res: Response) => {
      let input: ValidDiscoverRequest;

      try {
        input = validateDiscoverRequest(
          req.body as Partial<DiscoverRequest>,
        );
      } catch (error) {
        return res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid discovery request.",
        });
      }

      try {
        const definition = getIndexerDefinition(
          definitions,
          input.kind,
        );

        const records = await store.discover(
          definition,
          input.fromBlock,
          input.toBlock,
        );

        return res.json(records);
      } catch {
        console.error("[discover] indexed lookup failed");

        return res.status(500).json({
          error: "Discovery failed.",
        });
      }
    },
  );

  return router;
}
