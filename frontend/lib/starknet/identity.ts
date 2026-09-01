import {
  RpcProvider,
} from "starknet";

import {
  RPC_URL,
} from "@/lib/starknet/constants";

const provider =
  new RpcProvider({
    nodeUrl: RPC_URL,
  });

export interface StarkIdentityProfile {
  name: string | null;
  profilePicture: string | null;
  proofOfPersonhood: boolean;
}

const starkNameCache =
  new Map<
    string,
    Promise<string | null>
  >();

const starkProfileCache =
  new Map<
    string,
    Promise<StarkIdentityProfile | null>
  >();

const starkAddressCache =
  new Map<
    string,
    Promise<string | null>
  >();

function canonicalAddress(
  address: string,
): string {
  try {
    return `0x${BigInt(
      address,
    ).toString(16)}`;
  } catch {
    return address.toLowerCase();
  }
}

function normalizeProfilePicture(
  value: unknown,
): string | null {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  try {
    const url =
      new URL(value.trim());

    /*
     * Starknet ID profile data is presentation-only and comes from public
     * metadata. Restrict remote avatar rendering to normal web URLs so an
     * identity record can never inject an executable/custom URL scheme.
     */
    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function normalizeStarkName(
  value: string,
): string {
  const name =
    value.trim().toLowerCase();

  if (!name) {
    return "";
  }

  return name.endsWith(".stark")
    ? name
    : `${name}.stark`;
}

export function shortIdentityAddress(
  address: string,
): string {
  if (!address) {
    return "Participant";
  }

  return address.length > 13
    ? `${address.slice(
        0,
        6,
      )}...${address.slice(-4)}`
    : address;
}

export async function resolveStarkName(
  address: string,
): Promise<string | null> {
  if (!address) {
    return null;
  }

  const key =
    canonicalAddress(address);

  const existing =
    starkNameCache.get(key);

  if (existing) {
    return existing;
  }

  /*
   * Starknet ID lookup is read-only RPC work. It does not ask Ready to sign
   * and it never changes VINSS authorization: the canonical wallet address
   * remains the identity used for routing, encryption, offers, and Rekber.
   */
  const request =
    provider
      .getStarkName(key)
      .then((name) => {
        const normalized =
          typeof name === "string"
            ? name.trim()
            : "";

        return normalized || null;
      })
      .catch(() => null);

  starkNameCache.set(
    key,
    request,
  );

  return request;
}

export async function resolveStarkProfile(
  address: string,
): Promise<StarkIdentityProfile | null> {
  if (!address) {
    return null;
  }

  const key =
    canonicalAddress(address);

  const existing =
    starkProfileCache.get(key);

  if (existing) {
    return existing;
  }

  /*
   * Profile data is display metadata only. Never use a .stark name, avatar,
   * or proof-of-personhood flag as authorization for a VINSS deal action.
   */
  const request =
    provider
      .getStarkProfile(key)
      .then((rawProfile) => {
        const profile =
          rawProfile as {
            name?: unknown;
            profilePicture?: unknown;
            proofOfPersonhood?: unknown;
          };

        const name =
          typeof profile.name ===
            "string" &&
          profile.name.trim()
            ? profile.name.trim()
            : null;

        return {
          name,
          profilePicture:
            normalizeProfilePicture(
              profile.profilePicture,
            ),
          proofOfPersonhood:
            profile.proofOfPersonhood ===
            true,
        };
      })
      .catch(() => null);

  starkProfileCache.set(
    key,
    request,
  );

  return request;
}

export async function resolveStarkAddress(
  name: string,
): Promise<string | null> {
  const key =
    normalizeStarkName(name);

  if (!key) {
    return null;
  }

  const existing =
    starkAddressCache.get(key);

  if (existing) {
    return existing;
  }

  /*
   * Forward resolution only translates a human-readable .stark name to an
   * address. Callers must still enforce their own VINSS access rules after
   * resolution; knowing a .stark name never grants room membership.
   */
  const request =
    provider
      .getAddressFromStarkName(
        key,
      )
      .then((address) =>
        address
          ? canonicalAddress(
              String(address),
            )
          : null,
      )
      .catch(() => null);

  starkAddressCache.set(
    key,
    request,
  );

  return request;
}
