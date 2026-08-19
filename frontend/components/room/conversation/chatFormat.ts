import { NETWORK } from "@/lib/starknet/constants";

export function explorerUrl(
  transactionHash: string,
): string {
  return NETWORK === "mainnet"
    ? `https://voyager.online/tx/${transactionHash}`
    : `https://sepolia.voyager.online/tx/${transactionHash}`;
}

export function shortAddress(
  address: string,
): string {
  if (address.length <= 14) return address;

  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

export function messageTime(
  sentAt: string,
): string {
  return new Date(
    sentAt,
  ).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
