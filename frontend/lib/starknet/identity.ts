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

const starkNameCache =
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
