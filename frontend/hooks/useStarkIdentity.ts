"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  resolveStarkName,
  resolveStarkProfile,
  shortIdentityAddress,
  type StarkIdentityProfile,
} from "@/lib/starknet/identity";

export function useStarkIdentity(
  address?: string | null,
) {
  const [starkName, setStarkName] =
    useState<string | null>(
      null,
    );

  const [profile, setProfile] =
    useState<StarkIdentityProfile | null>(
      null,
    );

  useEffect(() => {
    let cancelled = false;

    setStarkName(null);
    setProfile(null);

    if (!address) {
      return () => {
        cancelled = true;
      };
    }

    /*
     * Name and profile lookups are public RPC reads. They run independently
     * so a missing profile picture can never prevent the existing .stark name
     * fallback from resolving.
     */
    void Promise.all([
      resolveStarkName(
        address,
      ),
      resolveStarkProfile(
        address,
      ),
    ]).then(
      ([
        name,
        nextProfile,
      ]) => {
        if (cancelled) {
          return;
        }

        setProfile(
          nextProfile,
        );

        setStarkName(
          name ||
            nextProfile?.name ||
            null,
        );
      },
    );

    return () => {
      cancelled = true;
    };
  }, [address]);

  return {
    starkName,
    profile,
    profilePicture:
      profile?.profilePicture ??
      null,
    proofOfPersonhood:
      profile?.proofOfPersonhood ??
      false,

    /*
     * The display label may be human-readable, but the caller must keep using
     * the original address for every security-sensitive VINSS operation.
     */
    label:
      starkName ||
      shortIdentityAddress(
        address ?? "",
      ),
  };
}
