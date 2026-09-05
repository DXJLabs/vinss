import type {
  Pool,
} from "pg";

import {
  sanitizeDisputeSignature,
} from "./attestation.js";
import type {
  DisputeRole,
} from "./types.js";

export interface StoredDisputeAttestations {
  payer: string[] | null;
  payee: string[] | null;
}

export async function initializeDisputeAttestationStorage(
  database: Pool,
): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS vinss_dispute_attestations (
      network TEXT NOT NULL,
      case_commitment TEXT NOT NULL,
      role TEXT NOT NULL CHECK (
        role IN ('payer', 'payee')
      ),
      custody_commitment TEXT,
      wallet_address TEXT NOT NULL,
      signature JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (
        network,
        case_commitment,
        role
      )
    )
  `);

  /*
   * Existing production rows were created before custody binding was stored.
   * Reloading an existing room safely backfills this after the backend
   * re-verifies the exact dispute case and Rekber binding.
   */
  await database.query(`
    ALTER TABLE vinss_dispute_attestations
    ADD COLUMN IF NOT EXISTS custody_commitment TEXT
  `);
}

export async function storeDisputeAttestation(
  database: Pool,
  network: string,
  caseCommitment: string,
  custodyCommitment: string,
  role: DisputeRole,
  walletAddress: string,
  signature: string[],
): Promise<void> {
  await database.query(
    `
      INSERT INTO vinss_dispute_attestations (
        network,
        case_commitment,
        role,
        custody_commitment,
        wallet_address,
        signature
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb
      )
      ON CONFLICT (
        network,
        case_commitment,
        role
      )
      DO NOTHING
    `,
    [
      network,
      caseCommitment,
      role,
      custodyCommitment,
      walletAddress,
      JSON.stringify(signature),
    ],
  );

  /*
   * Backfill only an old NULL association. Never silently replace an
   * already-recorded case/custody association.
   */
  await database.query(
    `
      UPDATE vinss_dispute_attestations
      SET custody_commitment = $4
      WHERE
        network = $1 AND
        case_commitment = $2 AND
        role = $3 AND
        custody_commitment IS NULL
    `,
    [
      network,
      caseCommitment,
      role,
      custodyCommitment,
    ],
  );
}

export async function readDisputeAttestations(
  database: Pool,
  network: string,
  caseCommitment: string,
): Promise<StoredDisputeAttestations> {
  const result =
    await database.query<{
      role: string;
      signature: unknown;
    }>(
      `
        SELECT
          role,
          signature
        FROM vinss_dispute_attestations
        WHERE
          network = $1 AND
          case_commitment = $2
      `,
      [
        network,
        caseCommitment,
      ],
    );

  let payer: string[] | null =
    null;
  let payee: string[] | null =
    null;

  for (const row of result.rows) {
    if (row.role === "payer") {
      payer =
        sanitizeDisputeSignature(
          row.signature,
          "payer",
        );
    }

    if (row.role === "payee") {
      payee =
        sanitizeDisputeSignature(
          row.signature,
          "payee",
        );
    }
  }

  return {
    payer,
    payee,
  };
}
