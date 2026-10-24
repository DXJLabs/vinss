/** Read-only proof of an exact public Unshield payment on Starknet Sepolia.
 * No signing; requires the sending wallet address as well as the recipient.
 * From frontend/: node --experimental-strip-types scripts/verify-sepolia-unshield.mjs TX_HASH STRK|USDC RECIPIENT AMOUNT SENDER
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeStarknetAddress } from "../lib/starknet/unshield.ts";
import { verifyPublicTransferReceipt } from "../lib/starknet/publicTransferReceipt.ts";

/** Legacy export name retained for existing callers; this verifies a public transfer. */
export async function verifySepoliaUnshield(provider, input) {
  if (BigInt(await provider.getChainId()) !== 0x534e5f5345504f4c4941n) {
    throw new Error("Refusing receipt verification on an RPC other than Starknet Sepolia.");
  }
  const txHash = normalizeStarknetAddress(input.txHash);
  const token = normalizeStarknetAddress(input.token);
  const sender = normalizeStarknetAddress(input.sender);
  const recipient = normalizeStarknetAddress(input.recipient);
  if (typeof input.amountUnits !== "bigint" || input.amountUnits <= 0n) {
    throw new Error("Expected public transfer amount must be positive bigint units.");
  }
  const receipt = await provider.getTransactionReceipt(txHash);
  const result = verifyPublicTransferReceipt(receipt, {
    ...input, transactionHash: txHash, token, sender, recipient,
  });
  if (result.status !== "confirmed") {
    throw new Error(result.status === "reverted" ? "Public transfer reverted." : "Public transfer is not yet accepted on Starknet.");
  }
  return {
    chainId: "0x534e5f5345504f4c4941",
    transactionHash: txHash, token, sender, recipient,
    publicTransferUnits: input.amountUnits.toString(),
    executionStatus: receipt.execution_status,
    finalityStatus: receipt.finality_status,
    blockNumber: receipt.block_number ?? null,
    networkFee: result.networkFee ? { amount: "0x" + result.networkFee.amount.toString(16), unit: result.networkFee.unit } : null,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [txHash, asset, recipient, amount, sender] = process.argv.slice(2);
    if (!txHash || !asset || !recipient || !amount || !sender || process.argv.length !== 7) {
      throw new Error("Usage: node --experimental-strip-types scripts/verify-sepolia-unshield.mjs TX_HASH STRK|USDC RECIPIENT AMOUNT SENDER");
    }
    if (process.env.NEXT_PUBLIC_STARKNET_NETWORK !== "sepolia") {
      throw new Error("Set NEXT_PUBLIC_STARKNET_NETWORK=sepolia; other networks are refused.");
    }
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) throw new Error("Set NEXT_PUBLIC_RPC_URL to a trusted Sepolia RPC URL.");
    const options = asset === "STRK"
      ? { address: process.env.NEXT_PUBLIC_STRK_ADDRESS, decimals: 18 }
      : asset === "USDC"
      ? { address: process.env.NEXT_PUBLIC_USDC_ADDRESS, decimals: 6 }
      : null;
    if (!options?.address) throw new Error("Unsupported asset or missing token address.");
    const { buildPublicTransferCall } = await import("../lib/starknet/publicTransfer.ts");
    const call = buildPublicTransferCall({
      token: options.address, recipient, amount, decimals: options.decimals,
    });

    const { RpcProvider, hash } = await import("starknet");
    const provider = new RpcProvider({ nodeUrl: rpcUrl });
    const result = await verifySepoliaUnshield(provider, {
      txHash, token: call.contractAddress, sender, recipient: call.calldata[0],
      amountUnits: BigInt(call.calldata[1]) + (BigInt(call.calldata[2]) << 128n),
      transferSelector: hash.getSelectorFromName("Transfer"),
    });
    console.log(JSON.stringify({
      evidence: "Sepolia accepted INVOKE receipt with exact ERC-20 Transfer",
      ...result,
      explorer: "https://sepolia.starkscan.co/tx/" + result.transactionHash,
      notice: "Network fee is not VINSS fee or STRK20 privacy fee. This proves a public transfer, not private STRK20 withdrawal. Verify wallet quote separately.",
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
