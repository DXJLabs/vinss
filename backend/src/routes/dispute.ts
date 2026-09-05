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
  sanitizeDisputeSignature,
  verifyDisputeAttestation,
  verifyDisputeAttestations,
} from "../dispute/attestation.js";
import {
  readDisputeAttestations,
  storeDisputeAttestation,
} from "../dispute/attestationStore.js";
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
  decisionForDisputeExecution,
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
  DisputeRole,
} from "../dispute/types.js";

interface DisputeRequestBody {
  case?: unknown;
  attestations?: unknown;
  binding?: unknown;
  role?: unknown;
  signature?: unknown;
  caseCommitment?: unknown;

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

function sanitizeRole(
  value: unknown,
): DisputeRole {
  if (
    value !== "payer" &&
    value !== "payee"
  ) {
    throw new Error(
      "Dispute attestation role must be payer or payee.",
    );
  }

  return value;
}

function sanitizeCaseCommitment(
  value: unknown,
): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 256
  ) {
    throw new Error(
      "Dispute case commitment is required.",
    );
  }

  return value.trim();
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

  /*
   * Store a wallet's signed Agent-review attestation directly over HTTPS.
   *
   * The wallet signature itself is the authorization proof. It does not need
   * to be wrapped in a paid STRK20 transaction. Before persistence, the
   * backend re-verifies live custody, original Rekber party binding and the
   * exact SNIP-12 signature.
   */
  router.post(
    "/dispute/attestation",
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

        const role =
          sanitizeRole(
            body.role,
          );

        const signature =
          sanitizeDisputeSignature(
            body.signature,
            role,
          );

        const custody =
          await readAndVerifyDisputeCustody(
            config,
            disputeCase,
          );

        await verifyDisputeRekberBinding(
          config,
          disputeCase,
          custody,
          binding,
        );

        await verifyDisputeAttestation(
          config,
          disputeCase,
          role,
          signature,
        );

        const caseCommitment =
          computeDisputeCaseCommitment(
            disputeCase,
          );

        const walletAddress =
          role === "payer"
            ? disputeCase.payer
                .walletAddress
            : disputeCase.payee
                .walletAddress;

        await storeDisputeAttestation(
          database,
          config.network,
          caseCommitment,
          disputeCase.custodyCommitment,
          role,
          walletAddress,
          signature,
        );

        const stored =
          await readDisputeAttestations(
            database,
            config.network,
            caseCommitment,
          );

        return res.json({
          caseCommitment,
          payerSigned:
            Boolean(stored.payer),
          payeeSigned:
            Boolean(stored.payee),
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

  /*
   * Poll only signature presence. No evidence, room secret, private key or
   * signature bytes are returned to the browser.
   */
  router.post(
    "/dispute/attestation/status",
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

        /*
         * Status polling is also the safe migration path for attestations
         * created before Case -> Custody persistence existed.
         *
         * Never backfill from a case commitment alone. First prove the exact
         * live Rekber custody and the original Agreement/party binding.
         */
        const custody =
          await readAndVerifyDisputeCustody(
            config,
            disputeCase,
          );

        await verifyDisputeRekberBinding(
          config,
          disputeCase,
          custody,
          binding,
        );

        const caseCommitment =
          computeDisputeCaseCommitment(
            disputeCase,
          );

        const stored =
          await readDisputeAttestations(
            database,
            config.network,
            caseCommitment,
          );

        /*
         * Re-verify every persisted wallet signature before using it to
         * backfill custody association. Presence in PostgreSQL alone is not
         * authority.
         */
        if (stored.payer) {
          await verifyDisputeAttestation(
            config,
            disputeCase,
            "payer",
            stored.payer,
          );

          await storeDisputeAttestation(
            database,
            config.network,
            caseCommitment,
            disputeCase.custodyCommitment,
            "payer",
            disputeCase.payer
              .walletAddress,
            stored.payer,
          );
        }

        if (stored.payee) {
          await verifyDisputeAttestation(
            config,
            disputeCase,
            "payee",
            stored.payee,
          );

          await storeDisputeAttestation(
            database,
            config.network,
            caseCommitment,
            disputeCase.custodyCommitment,
            "payee",
            disputeCase.payee
              .walletAddress,
            stored.payee,
          );
        }

        const refreshed =
          await readDisputeAttestations(
            database,
            config.network,
            caseCommitment,
          );

        return res.json({
          caseCommitment,
          payerSigned:
            Boolean(refreshed.payer),
          payeeSigned:
            Boolean(refreshed.payee),
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

        await verifyDisputeRekberBinding(
          config,
          disputeCase,
          custody,
          binding,
        );

        const caseCommitment =
          computeDisputeCaseCommitment(
            disputeCase,
          );

        let attestations:
          ReturnType<
            typeof sanitizeDisputeAttestations
          >;

        /*
         * Backward compatibility:
         * old clients may still provide signatures discovered through private
         * coordination. Verify and migrate them into persistent HTTPS
         * attestation storage once, without asking users to sign again.
         */
        if (
          body.attestations !==
          undefined
        ) {
          attestations =
            sanitizeDisputeAttestations(
              body.attestations,
            );

          await verifyDisputeAttestations(
            config,
            disputeCase,
            attestations,
          );

          await Promise.all([
            storeDisputeAttestation(
              database,
              config.network,
              caseCommitment,
              disputeCase.custodyCommitment,
              "payer",
              disputeCase.payer
                .walletAddress,
              attestations.payer,
            ),
            storeDisputeAttestation(
              database,
              config.network,
              caseCommitment,
              disputeCase.custodyCommitment,
              "payee",
              disputeCase.payee
                .walletAddress,
              attestations.payee,
            ),
          ]);
        } else {
          const stored =
            await readDisputeAttestations(
              database,
              config.network,
              caseCommitment,
            );

          if (
            !stored.payer ||
            !stored.payee
          ) {
            throw new Error(
              "Both verified dispute attestations are required before Agent evaluation.",
            );
          }

          attestations = {
            payer:
              stored.payer,
            payee:
              stored.payee,
          };

          /*
           * Re-verify persisted signatures against the exact case before every
           * evaluation/execution attempt. Database presence alone is never
           * treated as financial authority.
           */
          await verifyDisputeAttestations(
            config,
            disputeCase,
            attestations,
          );

          /*
           * Safe migration for attestations created before the persistent
           * Case -> Custody association was introduced.
           *
           * We reach this point only after:
           * - live custody verification,
           * - original Rekber Agreement/party binding verification, and
           * - both persisted SNIP-12 signatures being re-verified against
           *   this exact dispute case.
           *
           * storeDisputeAttestation() only backfills a NULL custody binding;
           * it never replaces an existing non-NULL association.
           */
          await Promise.all([
            storeDisputeAttestation(
              database,
              config.network,
              caseCommitment,
              disputeCase.custodyCommitment,
              "payer",
              disputeCase.payer
                .walletAddress,
              attestations.payer,
            ),
            storeDisputeAttestation(
              database,
              config.network,
              caseCommitment,
              disputeCase.custodyCommitment,
              "payee",
              disputeCase.payee
                .walletAddress,
              attestations.payee,
            ),
          ]);
        }

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

        /*
         * The persisted Agent decision never gets rerolled. If evidence is too
         * weak for a directional award, policy converts only the execution
         * split to the deterministic 50/50 AutoSplit fallback.
         */
        const executionDecision =
          decisionForDisputeExecution(
            decision,
            policy,
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
              executionDecision,
            );
        }

        return res.json({
          caseCommitment,

          // Show clients the exact split that can actually execute on-chain.
          decision:
            executionDecision,
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
