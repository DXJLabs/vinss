import {
  randomUUID,
} from "node:crypto";

import type {
  Pool,
} from "pg";

import {
  parseDisputeAgentDecision,
} from "./decision.js";
import type {
  DisputeAgentDecision,
} from "./types.js";

export interface StoredDisputeDecision {
  decision: DisputeAgentDecision;
  provider: string;
  model: string;
}

export type DisputeEvaluationClaim =
  | {
      status: "claimed";
      leaseToken: string;
    }
  | {
      status: "complete";
      value: StoredDisputeDecision;
    }
  | {
      status: "in_progress";
    };

interface EvaluationRow {
  state: string;
  decision: unknown;
  provider: string | null;
  model: string | null;
}

function storedDecision(
  row: EvaluationRow,
): StoredDisputeDecision {
  if (
    row.state !== "complete" ||
    !row.decision ||
    !row.provider ||
    !row.model
  ) {
    throw new Error(
      "Stored dispute evaluation is incomplete.",
    );
  }

  return {
    decision:
      parseDisputeAgentDecision(
        JSON.stringify(
          row.decision,
        ),
      ),
    provider:
      row.provider,
    model:
      row.model,
  };
}

export async function initializeDisputeDecisionStorage(
  database: Pool,
): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS vinss_dispute_evaluations (
      network TEXT NOT NULL,
      case_commitment TEXT NOT NULL,
      state TEXT NOT NULL CHECK (
        state IN ('pending', 'complete')
      ),
      lease_token TEXT NOT NULL,
      decision JSONB,
      provider TEXT,
      model TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      PRIMARY KEY (
        network,
        case_commitment
      )
    )
  `);
}

async function readEvaluation(
  database: Pool,
  network: string,
  caseCommitment: string,
): Promise<EvaluationRow | null> {
  const result =
    await database.query<EvaluationRow>(
      `
        SELECT
          state,
          decision,
          provider,
          model
        FROM vinss_dispute_evaluations
        WHERE
          network = $1 AND
          case_commitment = $2
        LIMIT 1
      `,
      [
        network,
        caseCommitment,
      ],
    );

  return result.rows[0] ?? null;
}

/*
 * Exactly one backend worker owns the first evaluation.
 *
 * Concurrent callers never start another LLM evaluation for the same
 * case. A lease can only be reclaimed after 10 minutes, protecting
 * against a process dying permanently in "pending".
 */
export async function claimDisputeEvaluation(
  database: Pool,
  network: string,
  caseCommitment: string,
): Promise<DisputeEvaluationClaim> {
  const leaseToken =
    randomUUID();

  const inserted =
    await database.query(
      `
        INSERT INTO vinss_dispute_evaluations (
          network,
          case_commitment,
          state,
          lease_token
        )
        VALUES ($1, $2, 'pending', $3)
        ON CONFLICT (
          network,
          case_commitment
        )
        DO NOTHING
        RETURNING case_commitment
      `,
      [
        network,
        caseCommitment,
        leaseToken,
      ],
    );

  if (
    inserted.rowCount === 1
  ) {
    return {
      status: "claimed",
      leaseToken,
    };
  }

  const existing =
    await readEvaluation(
      database,
      network,
      caseCommitment,
    );

  if (
    existing?.state ===
    "complete"
  ) {
    return {
      status: "complete",
      value:
        storedDecision(
          existing,
        ),
    };
  }

  /*
   * Crash recovery only. A normal request must never replace an active
   * evaluator. The lease token prevents an old worker from later writing
   * over a reclaimed evaluation.
   */
  const reclaimed =
    await database.query(
      `
        UPDATE vinss_dispute_evaluations
        SET
          lease_token = $3,
          started_at = NOW(),
          decision = NULL,
          provider = NULL,
          model = NULL,
          completed_at = NULL
        WHERE
          network = $1 AND
          case_commitment = $2 AND
          state = 'pending' AND
          started_at <
            NOW() - INTERVAL '10 minutes'
        RETURNING case_commitment
      `,
      [
        network,
        caseCommitment,
        leaseToken,
      ],
    );

  if (
    reclaimed.rowCount === 1
  ) {
    return {
      status: "claimed",
      leaseToken,
    };
  }

  return {
    status:
      "in_progress",
  };
}

export async function completeDisputeEvaluation(
  database: Pool,
  network: string,
  caseCommitment: string,
  leaseToken: string,
  value: StoredDisputeDecision,
): Promise<void> {
  const result =
    await database.query(
      `
        UPDATE vinss_dispute_evaluations
        SET
          state = 'complete',
          decision = $4::jsonb,
          provider = $5,
          model = $6,
          completed_at = NOW()
        WHERE
          network = $1 AND
          case_commitment = $2 AND
          lease_token = $3 AND
          state = 'pending'
      `,
      [
        network,
        caseCommitment,
        leaseToken,
        JSON.stringify(
          value.decision,
        ),
        value.provider,
        value.model,
      ],
    );

  if (
    result.rowCount !== 1
  ) {
    throw new Error(
      "Dispute evaluation lease was lost before persistence.",
    );
  }
}

export async function releaseDisputeEvaluation(
  database: Pool,
  network: string,
  caseCommitment: string,
  leaseToken: string,
): Promise<void> {
  await database.query(
    `
      DELETE FROM vinss_dispute_evaluations
      WHERE
        network = $1 AND
        case_commitment = $2 AND
        lease_token = $3 AND
        state = 'pending'
    `,
    [
      network,
      caseCommitment,
      leaseToken,
    ],
  );
}
