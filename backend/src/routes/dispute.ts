import {
  Router,
  type Request,
  type Response,
} from "express";

import {
  isLlmSelection,
} from "../agent/providers/registry.js";
import type {
  AppConfig,
} from "../config.js";
import {
  buildDisputeAttestationTypedData,
  sanitizeDisputeAttestations,
  verifyDisputeAttestations,
} from "../dispute/attestation.js";
import {
  readAndVerifyDisputeCustody,
} from "../dispute/chain.js";
import {
  computeDisputeCaseCommitment,
  sanitizeDisputeCase,
} from "../dispute/evidence.js";
import {
  evaluateDisputeCase,
} from "../dispute/service.js";

interface DisputeRequestBody {
  case?: unknown;
  attestations?: unknown;
  provider?: unknown;
}

function publicError(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Invalid dispute request.";
}

export function createDisputeRouter(
  config: AppConfig,
): Router {
  const router =
    Router();

  router.post(
    "/dispute/challenge",
    async (
      req: Request,
      res: Response,
    ) => {
      const body =
        req.body as
          DisputeRequestBody;

      try {
        const disputeCase =
          sanitizeDisputeCase(
            body.case,
          );

        /*
         * Do not issue signatures over a stale/fabricated lifecycle snapshot.
         * Challenge creation itself is bound to current Rekber state.
         */
        await readAndVerifyDisputeCustody(
          config,
          disputeCase,
        );

        return res.json({
          network:
            config.network,
          caseCommitment:
            computeDisputeCaseCommitment(
              disputeCase,
            ),
          typedData: {
            payer:
              buildDisputeAttestationTypedData(
                config,
                disputeCase,
                "payer",
              ),
            payee:
              buildDisputeAttestationTypedData(
                config,
                disputeCase,
                "payee",
              ),
          },
        });
      } catch (error) {
        return res
          .status(400)
          .json({
            error:
              publicError(
                error,
              ),
          });
      }
    },
  );

  router.post(
    "/dispute/evaluate",
    async (
      req: Request,
      res: Response,
    ) => {
      const body =
        req.body as
          DisputeRequestBody;

      if (
        body.provider !==
          undefined &&
        !isLlmSelection(
          body.provider,
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "provider must be auto, groq, openai, anthropic, or qwen.",
          });
      }

      try {
        const disputeCase =
          sanitizeDisputeCase(
            body.case,
          );

        const attestations =
          sanitizeDisputeAttestations(
            body.attestations,
          );

        /*
         * Re-read Rekber after signatures are collected. A dispute can resolve
         * or consume custody between challenge and evaluation.
         */
        await readAndVerifyDisputeCustody(
          config,
          disputeCase,
        );

        await verifyDisputeAttestations(
          config,
          disputeCase,
          attestations,
        );

        const result =
          await evaluateDisputeCase(
            disputeCase,
            {
              provider:
                body.provider,
            },
          );

        return res.json({
          ...result,
          network:
            config.network,

          // Explicitly state the capability boundary to consumers.
          execution:
            "not_enabled",
        });
      } catch (error) {
        /*
         * Never log request bodies or evidence. Provider errors are already
         * identity-only logged by the Agent runtime.
         */
        return res
          .status(400)
          .json({
            error:
              publicError(
                error,
              ),
          });
      }
    },
  );

  return router;
}
