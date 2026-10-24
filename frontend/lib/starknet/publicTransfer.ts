/** VINSS public payment rail. Not STRK20 note withdrawal and not escrow. */
import { normalizeStarknetAddress, parseTokenUnits } from "./unshield";
export type TransactionMode = "shield" | "unshield";
const UINT128_MAX = (1n << 128n) - 1n;
const UINT256_MAX = (1n << 256n) - 1n;
export interface PublicTransferRequest {
  token: string; recipient: string; amount: string; decimals: number;
}
export interface PublicTransferCall {
  contractAddress: string; entrypoint: "transfer"; calldata: [string, string, string];
}
/** ERC-20 transfer(ContractAddress recipient, u256 amount) via public account.execute. */
export function buildPublicTransferCall(input: PublicTransferRequest): PublicTransferCall {
  const token = normalizeStarknetAddress(input.token);
  const recipient = normalizeStarknetAddress(input.recipient);
  const amount = parseTokenUnits(input.amount, input.decimals);
  if (amount > UINT256_MAX) throw new Error("Amount exceeds ERC-20 u256 maximum.");
  return {
    contractAddress: token,
    entrypoint: "transfer",
    calldata: [recipient, "0x" + (amount & UINT128_MAX).toString(16), "0x" + (amount >> 128n).toString(16)],
  };
}
