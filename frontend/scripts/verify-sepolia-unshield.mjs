/** Read-only proof of public ERC-20 payout after native STRK20 Unshield on Sepolia.
 * Does not prove wallet shielded accounting or fee quote; no private keys/signing.
 * From frontend/: node --experimental-strip-types scripts/verify-sepolia-unshield.mjs TX_HASH STRK|USDC RECIPIENT AMOUNT
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SEPOLIA_CHAIN_ID = 0x534e5f5345504f4c4941n;
const STARK_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const MAX_U128 = (1n << 128n) - 1n;
const ACCEPTED = new Set(["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"]);

function felt(value, label, allowZero = false) {
  if (typeof value !== "string" || !/^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) {
    throw new Error(label + " is not a valid Starknet felt.");
  }
  const number = BigInt(value);
  if (number >= STARK_PRIME || (!allowZero && number === 0n)) {
    throw new Error(label + " is outside the Starknet field.");
  }
  return "0x" + number.toString(16);
}

function u128(value) {
  if (typeof value !== "string" || !/^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) {
    throw new Error("Invalid ERC-20 u256 limb.");
  }
  const number = BigInt(value);
  if (number > MAX_U128) throw new Error("Invalid ERC-20 u256 limb.");
  return number;
}

function transferToRecipient(event, token, recipient, selector) {
  if (!event || typeof event !== "object") return null;
  if (!Array.isArray(event.keys) || !Array.isArray(event.data)) return null;
  if (felt(event.from_address, "Event contract") !== token) return null;
  if (event.keys.length < 1 || felt(event.keys[0], "Event selector") !== selector) return null;

  // SNIP-13 indexed: keys = [Transfer, from, to], data = [low, high].
  // Legacy: keys = [Transfer], data = [from, to, low, high].
  let from, to, low, high;
  if (event.keys.length === 3 && event.data.length === 2) {
    [, from, to] = event.keys;
    [low, high] = event.data;
  } else if (event.keys.length === 1 && event.data.length === 4) {
    [from, to, low, high] = event.data;
  } else {
    return null;
  }
  felt(from, "Transfer sender", true);
  if (felt(to, "Transfer recipient") !== recipient) return null;
  return u128(low) + (u128(high) << 128n);
}

/** Verify chain, finality, execution, and exact token payout in receipt. */
export async function verifySepoliaUnshield(provider, input) {
  const txHash = felt(input.txHash, "Transaction hash");
  const token = felt(input.token, "Token");
  const recipient = felt(input.recipient, "Recipient");
  const selector = felt(input.transferSelector, "Transfer selector");
  if (typeof input.amountUnits !== "bigint" || input.amountUnits <= 0n) {
    throw new Error("Expected Unshield token amount must be positive bigint units.");
  }

  const chain = felt(await provider.getChainId(), "RPC chain ID");
  if (BigInt(chain) !== SEPOLIA_CHAIN_ID) {
    throw new Error("Refusing receipt verification on an RPC other than Starknet Sepolia.");
  }
  const receipt = await provider.getTransactionReceipt(txHash);
  if (felt(receipt.transaction_hash, "Receipt hash") !== txHash) {
    throw new Error("RPC receipt does not match the requested transaction hash.");
  }
  if (receipt.type !== "INVOKE") {
    throw new Error("Expected an INVOKE transaction for a native STRK20 Unshield.");
  }
  if (receipt.execution_status !== "SUCCEEDED") {
    throw new Error("Unshield transaction did not execute successfully.");
  }
  if (!ACCEPTED.has(receipt.finality_status)) {
    throw new Error("Unshield transaction is not yet accepted on Starknet.");
  }
  if (!Array.isArray(receipt.events)) {
    throw new Error("Receipt has no verifiable events.");
  }

  const transfers = receipt.events.map(event =>
    transferToRecipient(event, token, recipient, selector)
  ).filter(amount => amount !== null);
  if (!transfers.some(amount => amount === input.amountUnits)) {
    throw new Error("No exact ERC-20 Transfer to the recipient for the expected Unshield amount.");
  }

  const rawFee = receipt.actual_fee;
  const networkFee = rawFee && typeof rawFee.amount === "string" &&
    (rawFee.unit === "WEI" || rawFee.unit === "FRI")
    ? { amount: rawFee.amount, unit: rawFee.unit }
    : null;
  return {
    chainId: chain,
    transactionHash: txHash,
    token,
    recipient,
    publicTransferUnits: input.amountUnits.toString(),
    executionStatus: receipt.execution_status,
    finalityStatus: receipt.finality_status,
    blockNumber: receipt.block_number ?? null,
    networkFee,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [txHash, asset, recipient, amount] = process.argv.slice(2);
    if (!txHash || !asset || !recipient || !amount || process.argv.length !== 6) {
      throw new Error("Usage: node --experimental-strip-types scripts/verify-sepolia-unshield.mjs TX_HASH STRK|USDC RECIPIENT AMOUNT");
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
    const { buildUnshieldAction } = await import("../lib/starknet/unshield.ts");
    const action = buildUnshieldAction({
      token: options.address, recipient, amount, decimals: options.decimals,
    });

    const { RpcProvider, hash } = await import("starknet");
    const provider = new RpcProvider({ nodeUrl: rpcUrl });
    const result = await verifySepoliaUnshield(provider, {
      txHash, token: action.token, recipient: action.recipient,
      amountUnits: BigInt(action.amount),
      transferSelector: hash.getSelectorFromName("Transfer"),
    });
    console.log(JSON.stringify({
      evidence: "Sepolia accepted INVOKE receipt with exact ERC-20 Transfer",
      ...result,
      explorer: "https://sepolia.starkscan.co/tx/" + result.transactionHash,
      notice: "Network fee is not VINSS fee or STRK20 privacy fee. Verify wallet quote separately.",
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
