import {
  Router,
  type Request,
  type Response,
} from "express";

import type {
  StarknetNetwork,
} from "../config.js";

import {
  CertificateStore,
} from "../indexer/certificateStore.js";

import {
  calculateLoyalty,
} from "./service.js";

function canonicalAddress(
  value: string,
): string {
  if (
    !/^0x[0-9a-fA-F]+$/.test(value)
  ) {
    throw new Error(
      "Invalid Starknet address.",
    );
  }

  const numeric = BigInt(value);

  if (
    numeric <= 0n ||
    numeric >= 1n << 251n
  ) {
    throw new Error(
      "Invalid Starknet address.",
    );
  }

  return `0x${numeric.toString(16)}`;
}

export function createLoyaltyRouter(
  certificateStore: CertificateStore,
  network: StarknetNetwork,
  certificateContractAddress: string,
): Router {
  const router = Router();

  router.get(
    "/loyalty/:address",
    async (
      req: Request,
      res: Response,
    ) => {
      let address: string;

      try {
        address = canonicalAddress(
          req.params.address,
        );
      } catch (error) {
        return res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid address.",
        });
      }

      try {
        const stats =
          await certificateStore
            .recipientStats(
              network,
              certificateContractAddress,
              address,
            );

        const loyalty =
          calculateLoyalty({
            certificateCount:
              stats.certificateCount,
            successfulSettlements:
              stats.successfulSettlements,
          });

        return res.json({
          network,
          address,
          ...loyalty,
          latestCertificateIssuedAt:
            stats.latestIssuedAt,
          conversion: {
            status: "coming_soon",
          },
        });
      } catch (error) {
        console.error(
          "[loyalty] lookup failed",
          error instanceof Error
            ? error.name
            : "UnknownError",
        );

        return res.status(500).json({
          error:
            "Loyalty lookup failed.",
        });
      }
    },
  );

  return router;
}
