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
  sanitizeDisputeRekberBinding,
  verifyDisputeRekberBinding,
} from "../dispute/binding.js";
import {
  readAndVerifyDisputeCustody,
  readVerifiedPrincipalUsdMicros,
} from "../dispute/chain.js";
import {
  computeDisputeCaseCommitment,
  sanitizeDisputeCase,
} from "../dispute/evidence.js";
import {
  authorizeDisputeResolution,
  type DisputeExecutionResult,
} from "../dispute/executor.js";
import {
  evaluateDisputeCase,
} from "../dispute/service.js";

interface DisputeRequestBody {
  case?: unknown;
  attestations?: unknown;
  binding?: unknown;
  provider?: unknown;
}

function publicError(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Invalid dispute request.";
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

        const binding =
          sanitizeDisputeRekberBinding(
            body.binding,
          );

        const custody =
          await readAndVerifyDisputeCustody(
            config,
            disputeCase,
          );

        /*
         * Never ask Alice/Bob to sign an AutoSplit mandate until the backend
         * proves they are the wallets that signed this exact Rekber Agreement.
         */
        await verifyDisputeRekberBinding(
          config,
          disputeCase,
          custody,
          binding,
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

        const binding =
          sanitizeDisputeRekberBinding(
            body.binding,
          );

        /*
         * Re-read every authority at execution time. Browser lifecycle flags,
         * wallet identity and USD value are never trusted for AutoResolve.
         */
        const custody =
          await readAndVerifyDisputeCustody(
            config,
            disputeCase,
          );

        await Promise.all([
          verifyDisputeAttestations(
            config,
            disputeCase,
            attestations,
          ),
          verifyDisputeRekberBinding(
            config,
            disputeCase,
            custody,
            binding,
          ),
        ]);

        const verifiedPrincipalUsdMicros =
          await readVerifiedPrincipalUsdMicros(
            config,
            custody,
          );

        const result =
          await evaluateDisputeCase(
            disputeCase,
            {
              provider:
                body.provider,
              trust: {
                partyBindingVerified:
                  true,
                ...(verifiedPrincipalUsdMicros !==
                undefined
                  ? {
                      verifiedPrincipalUsdMicros,
                    }
                  : {}),
              },
            },
          );

        let execution:
          DisputeExecutionResult = {
            status:
              "not_eligible",
          };

        if (
          result.policy.status ===
          "AUTO_RESOLVE"
        ) {
          execution =
            await authorizeDisputeResolution(
              config,
              custody,
              result.caseCommitment,
              result.decision,
            );
        }

        return res.json({
          ...result,
          network:
            config.network,
          execution,
        });
      } catch (error) {
        /*
         * Do not log evidence, signatures or resolver credentials.
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
