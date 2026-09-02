import assert from "node:assert/strict";
import test from "node:test";
import type {
  Pool,
} from "pg";

import {
  claimDisputeEvaluation,
  completeDisputeEvaluation,
} from "../src/dispute/store.ts";

interface Row {
  state: "pending" | "complete";
  lease_token: string;
  decision: unknown;
  provider: string | null;
  model: string | null;
  started_at: Date;
}

function fakePool(): Pool {
  const rows =
    new Map<string, Row>();

  return {
    async query(
      sql: string,
      params: unknown[] = [],
    ) {
      const compact =
        sql.replace(/\s+/g, " ").trim();

      const network =
        String(params[0] ?? "");
      const commitment =
        String(params[1] ?? "");
      const key =
        `${network}:${commitment}`;

      if (
        compact.startsWith(
          "INSERT INTO vinss_dispute_evaluations",
        )
      ) {
        if (rows.has(key)) {
          return {
            rowCount: 0,
            rows: [],
          };
        }

        rows.set(key, {
          state: "pending",
          lease_token:
            String(params[2]),
          decision: null,
          provider: null,
          model: null,
          started_at:
            new Date(),
        });

        return {
          rowCount: 1,
          rows: [
            {
              case_commitment:
                commitment,
            },
          ],
        };
      }

      if (
        compact.startsWith(
          "SELECT state, decision, provider, model",
        )
      ) {
        const row =
          rows.get(key);

        return {
          rowCount:
            row ? 1 : 0,
          rows:
            row
              ? [
                  {
                    state:
                      row.state,
                    decision:
                      row.decision,
                    provider:
                      row.provider,
                    model:
                      row.model,
                  },
                ]
              : [],
        };
      }

      if (
        compact.startsWith(
          "UPDATE vinss_dispute_evaluations SET lease_token",
        )
      ) {
        /*
         * Tests never wait ten minutes, so an active pending evaluation cannot
         * be stolen.
         */
        return {
          rowCount: 0,
          rows: [],
        };
      }

      if (
        compact.startsWith(
          "UPDATE vinss_dispute_evaluations SET state = 'complete'",
        )
      ) {
        const row =
          rows.get(key);

        if (
          !row ||
          row.state !== "pending" ||
          row.lease_token !==
            String(params[2])
        ) {
          return {
            rowCount: 0,
            rows: [],
          };
        }

        row.state =
          "complete";
        row.decision =
          JSON.parse(
            String(params[3]),
          );
        row.provider =
          String(params[4]);
        row.model =
          String(params[5]);

        return {
          rowCount: 1,
          rows: [],
        };
      }

      throw new Error(
        `Unhandled fake SQL: ${compact}`,
      );
    },
  } as unknown as Pool;
}

const decision = {
  decision: "split" as const,
  payerBps: 3000,
  payeeBps: 7000,
  confidence: 0.95,
  reason:
    "First verified decision.",
  evidenceCommitment:
    "0xcase",
  flags: [],
};

test(
  "pending dispute evaluation cannot be rerolled concurrently",
  async () => {
    const database =
      fakePool();

    const first =
      await claimDisputeEvaluation(
        database,
        "mainnet",
        "0xcase",
      );

    assert.equal(
      first.status,
      "claimed",
    );

    const second =
      await claimDisputeEvaluation(
        database,
        "mainnet",
        "0xcase",
      );

    assert.equal(
      second.status,
      "in_progress",
    );
  },
);

test(
  "completed dispute always returns the first persisted decision",
  async () => {
    const database =
      fakePool();

    const first =
      await claimDisputeEvaluation(
        database,
        "mainnet",
        "0xcase",
      );

    assert.equal(
      first.status,
      "claimed",
    );

    if (
      first.status !==
      "claimed"
    ) {
      throw new Error(
        "claim failed",
      );
    }

    await completeDisputeEvaluation(
      database,
      "mainnet",
      "0xcase",
      first.leaseToken,
      {
        decision,
        provider:
          "groq",
        model:
          "model-a",
      },
    );

    const retry =
      await claimDisputeEvaluation(
        database,
        "mainnet",
        "0xcase",
      );

    assert.equal(
      retry.status,
      "complete",
    );

    if (
      retry.status !==
      "complete"
    ) {
      throw new Error(
        "stored result missing",
      );
    }

    assert.deepEqual(
      retry.value.decision,
      decision,
    );
    assert.equal(
      retry.value.provider,
      "groq",
    );
    assert.equal(
      retry.value.model,
      "model-a",
    );
  },
);
