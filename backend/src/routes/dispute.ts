import {
  Router,
  type Request,
  type Response,
} from "express";
import type {
  Pool,
} from "pg";

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
  evaluateDisputePolicy,
} from "../dispute/policy.js";
import {
  evaluateDisputeCase,
} from "../dispute/service.js";
import {
  claimDisputeEvaluation,
  completeDisputeEvaluation,
  releaseDisputeEvaluation,
} from "../dispute/store.js";
import type {
  DisputeAgentDecision,
} from "../dispute/types.js";

interface DisputeRequestBody {
  case?: unknown;
  attestations?: unknown;
  binding?: unknown;

  /*
   * Kept only so the API can explicitly reject an old/client-controlled
   * provider field. Provider selection is server authority.
   */
  provider?: unknown;
}

function publicError(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Invalid dispute request.";
}

function sleep(
  ms: number,
): Promise<void> {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms,
      ),
  );
}

export function createDisputeRouter(
  config: AppConfig,
  database: Pool,
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
         * Never ask either participant to sign an AutoSplit mandate until
         * the backend proves they are the original Rekber parties.
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

      /*
       * Prevent provider-shopping. The browser cannot choose which model
       * arbitrates a dispute.
       */
      if (
        body.provider !==
        undefined
      ) {
        return res
          .status(400)
          .json({
            error:
              "Dispute provider is server-controlled.",
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
         * Re-read every authority at evaluation/execution time.
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

        const trust = {
          partyBindingVerified:
            true,
          ...(verifiedPrincipalUsdMicros !==
          undefined
            ? {
                verifiedPrincipalUsdMicros,
              }
            : {}),
        };

        const caseCommitment =
          computeDisputeCaseCommitment(
            disputeCase,
          );

        let decision:
          DisputeAgentDecision | null =
          null;
        let providerName = "";
        let model = "";

        /*
         * All concurrent callers converge on the same persisted first
         * decision. No rerolling and no model-shopping.
         */
        for (
          let attempt = 0;
          attempt < 60;
          attempt += 1
        ) {
          const claim =
            await claimDisputeEvaluation(
              database,
              config.network,
              caseCommitment,
            );

          if (
            claim.status ===
            "complete"
          ) {
            decision =
              claim.value
                .decision;
            providerName =
              claim.value
                .provider;
            model =
              claim.value.model;
            break;
          }

          if (
            claim.status ===
            "in_progress"
          ) {
            await sleep(250);
            continue;
          }

          try {
            const first =
              await evaluateDisputeCase(
                disputeCase,
                {
                  /*
                   * Server-selected provider only.
                   */
                  provider:
                    config.agent
                      .defaultProvider,
                  trust,
                },
              );

            if (
              first.caseCommitment !==
              caseCommitment
            ) {
              throw new Error(
                "Dispute case commitment changed during evaluation.",
              );
            }

            await completeDisputeEvaluation(
              database,
              config.network,
              caseCommitment,
              claim.leaseToken,
              {
                decision:
                  first.decision,
                provider:
                  first.provider,
                model:
                  first.model,
              },
            );

            decision =
              first.decision;
            providerName =
              first.provider;
            model =
              first.model;

            break;
          } catch (error) {
            await releaseDisputeEvaluation(
              database,
              config.network,
              caseCommitment,
              claim.leaseToken,
            ).catch(
              () => undefined,
            );

            throw error;
          }
        }

        if (!decision) {
          throw new Error(
            "Dispute evaluation is still in progress. Retry shortly.",
          );
        }

        /*
         * The LLM decision is fixed, but live policy authority is recalculated
         * on every execution attempt using current chain state/value.
         */
        const policy =
          evaluateDisputePolicy(
            disputeCase,
            caseCommitment,
            decision,
            undefined,
            trust,
          );

        let execution:
          DisputeExecutionResult = {
            status:
              "not_eligible",
          };

        if (
          policy.status ===
          "AUTO_RESOLVE"
        ) {
          execution =
            await authorizeDisputeResolution(
              config,
              custody,
              caseCommitment,
              decision,
            );
        }

        return res.json({
          caseCommitment,
          decision,
          policy,
          provider:
            providerName,
          model,
          network:
            config.network,
          execution,
        });
      } catch (error) {
        /*
         * Never log evidence, signatures or resolver credentials.
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
