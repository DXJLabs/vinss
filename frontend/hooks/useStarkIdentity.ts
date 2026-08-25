"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  resolveStarkName,
  shortIdentityAddress,
} from "@/lib/starknet/identity";

export function useStarkIdentity(
  address?: string | null,
) {
  const [starkName, setStarkName] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    let cancelled = false;

    setStarkName(null);

    if (!address) {
      return () => {
        cancelled = true;
      };
    }

    void resolveStarkName(
      address,
    ).then((name) => {
      if (!cancelled) {
        setStarkName(name);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return {
    starkName,
    label:
      starkName ||
      shortIdentityAddress(
        address ?? "",
      ),
  };
}
