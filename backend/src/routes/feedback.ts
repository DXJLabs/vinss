import { Router } from "express";
import type { Pool } from "pg";

const DEAL_TYPES = new Set([
  "otc",
  "freelance",
  "goods",
  "digital_goods",
  "bounty",
  "nft",
  "other",
]);

const OUTCOMES = new Set([
  "released",
  "refunded",
]);

const ROLES = new Set([
  "payer",
  "payee",
  "unknown",
]);

const NETWORKS = new Set([
  "sepolia",
  "mainnet",
]);

interface FeedbackBody {
  outcome?: unknown;
  role?: unknown;
  dealType?: unknown;
  network?: unknown;
  rating?: unknown;
  comment?: unknown;
}

export async function initializeFeedbackStorage(
  database: Pool,
): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS vinss_feedback (
      id BIGSERIAL PRIMARY KEY,
      outcome TEXT NOT NULL,
      role TEXT NOT NULL,
      deal_type TEXT,
      network TEXT NOT NULL,
      rating SMALLINT NOT NULL,
      feedback_comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export function createFeedbackRouter(
  database: Pool,
): Router {
  const router = Router();

  const resendApiKey =
    process.env.RESEND_API_KEY?.trim() ?? "";

  const toEmail =
    process.env.FEEDBACK_TO_EMAIL?.trim() ||
    "dxjlabs@gmail.com";

  router.post(
    "/feedback",
    async (req, res) => {
      const body =
        (req.body ?? {}) as FeedbackBody;

      const outcome =
        typeof body.outcome === "string"
          ? body.outcome
          : "";

      const role =
        typeof body.role === "string"
          ? body.role
          : "";

      const dealType =
        typeof body.dealType === "string"
          ? body.dealType
          : "";

      const network =
        typeof body.network === "string"
          ? body.network
          : "";

      const rating =
        typeof body.rating === "number"
          ? body.rating
          : Number.NaN;

      const comment =
        typeof body.comment === "string"
          ? body.comment.trim()
          : "";

      if (
        !OUTCOMES.has(outcome) ||
        !ROLES.has(role) ||
        !NETWORKS.has(network) ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5 ||
        (dealType &&
          !DEAL_TYPES.has(dealType)) ||
        comment.length > 2000
      ) {
        res.status(400).json({
          error: "Invalid feedback.",
        });
        return;
      }

      try {
        const result =
          await database.query<{
            id: string;
            created_at: Date;
          }>(
            `
              INSERT INTO vinss_feedback (
                outcome,
                role,
                deal_type,
                network,
                rating,
                feedback_comment
              )
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING id, created_at
            `,
            [
              outcome,
              role,
              dealType || null,
              network,
              rating,
              comment || null,
            ],
          );

        const stored =
          result.rows[0];

        const emailQueued =
          Boolean(resendApiKey);

        res.status(201).json({
          ok: true,
          emailQueued,
        });

        /*
         * Email notification is deliberately best-effort.
         * Feedback is already stored in PostgreSQL, so a mail provider
         * problem must never make the user's request hang or fail.
         */
        if (resendApiKey) {
          const text = [
            "VINSS Feedback",
            "",
            `Result: ${outcome}`,
            `Role: ${role}`,
            `Deal type: ${dealType || "unknown"}`,
            `Rating: ${rating}/5`,
            `Network: ${network}`,
            `Time: ${
              stored?.created_at
                ? new Date(
                    stored.created_at,
                  ).toISOString()
                : new Date().toISOString()
            }`,
            "",
            "Comment:",
            comment || "(no comment)",
          ].join("\n");

          void fetch(
            "https://api.resend.com/emails",
            {
              method: "POST",
              headers: {
                Authorization:
                  `Bearer ${resendApiKey}`,
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                from:
                  "VINSS Feedback <onboarding@resend.dev>",
                to: [toEmail],
                subject:
                  `[VINSS] ${rating}/5 · ${outcome}`,
                text,
              }),
            },
          )
            .then((response) => {
              if (!response.ok) {
                console.error(
                  `[feedback] Resend notification failed (${response.status})`,
                );
                return;
              }

              console.log(
                "[feedback] email notification sent",
              );
            })
            .catch(() => {
              console.error(
                "[feedback] Resend notification failed",
              );
            });
        }
      } catch {
        console.error(
          "[feedback] storage failed",
        );

        res.status(500).json({
          error:
            "Feedback could not be saved.",
        });
      }
    },
  );

  return router;
}
