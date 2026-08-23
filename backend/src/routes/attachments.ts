import { createHash, timingSafeEqual } from "node:crypto";

import express, {
  Router,
  type Request,
  type Response,
} from "express";
import type { Pool } from "pg";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const TOKEN_HEADER = "x-vinss-attachment-token";
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hashToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

function readToken(req: Request): string | null {
  const value = req.header(TOKEN_HEADER)?.trim();
  if (!value || value.length < 32 || value.length > 256) return null;
  return value;
}

function sameTokenHash(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createAttachmentRouter(database: Pool): Router {
  const router = Router();

  let initPromise: Promise<void> | null = null;
  const ensureTable = (): Promise<void> => {
    if (!initPromise) {
      initPromise = database
        .query(`
          CREATE TABLE IF NOT EXISTS encrypted_attachments (
            id uuid PRIMARY KEY,
            token_hash bytea NOT NULL,
            ciphertext bytea NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          )
        `)
        .then(() => undefined);
    }
    return initPromise;
  };

  router.put(
    "/attachments/:id",
    express.raw({
      type: "application/octet-stream",
      limit: MAX_ATTACHMENT_BYTES,
    }),
    async (req: Request, res: Response) => {
      const id = req.params.id;
      const token = readToken(req);
      const body = req.body;

      if (!ID_PATTERN.test(id)) {
        res.status(400).json({ error: "Invalid attachment id." });
        return;
      }

      if (!token) {
        res.status(401).json({ error: "Missing attachment token." });
        return;
      }

      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: "Encrypted attachment body is required." });
        return;
      }

      if (body.length > MAX_ATTACHMENT_BYTES) {
        res.status(413).json({ error: "Attachment is too large." });
        return;
      }

      try {
        await ensureTable();
        const result = await database.query(
          `INSERT INTO encrypted_attachments (id, token_hash, ciphertext)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`,
          [id, hashToken(token), body],
        );

        if (result.rowCount !== 1) {
          res.status(409).json({ error: "Attachment id already exists." });
          return;
        }

        res.status(201).json({ id });
      } catch {
        console.error("[attachments] encrypted upload failed");
        res.status(503).json({ error: "Encrypted attachment storage is unavailable." });
      }
    },
  );

  router.get(
    "/attachments/:id",
    async (req: Request, res: Response) => {
      const id = req.params.id;
      const token = readToken(req);

      if (!ID_PATTERN.test(id)) {
        res.status(400).json({ error: "Invalid attachment id." });
        return;
      }

      if (!token) {
        res.status(401).json({ error: "Missing attachment token." });
        return;
      }

      try {
        await ensureTable();
        const result = await database.query<{
          token_hash: Buffer;
          ciphertext: Buffer;
        }>(
          `SELECT token_hash, ciphertext
           FROM encrypted_attachments
           WHERE id = $1
           LIMIT 1`,
          [id],
        );

        const row = result.rows[0];
        if (!row) {
          res.status(404).json({ error: "Attachment not found." });
          return;
        }

        if (!sameTokenHash(row.token_hash, hashToken(token))) {
          res.status(404).json({ error: "Attachment not found." });
          return;
        }

        res.setHeader("Cache-Control", "private, max-age=300");
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Length", String(row.ciphertext.length));
        res.status(200).send(row.ciphertext);
      } catch {
        console.error("[attachments] encrypted download failed");
        res.status(503).json({ error: "Encrypted attachment storage is unavailable." });
      }
    },
  );

  return router;
}
