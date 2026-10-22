/**
 * Read-only Sepolia VINSS service fee audit. No signing or transfers.
 * Does not estimate STRK20 wallet/protocol fees or prove a fee-policy redeploy.
 * Run from frontend/ after npm ci, with NEXT_PUBLIC_* Sepolia configuration.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SEPOLIA_CHAIN_ID = 0x534e5f5345504f4c4941n;
const PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const ACTIONS = [
  { action: "roomActivation", number: 1, baseUsdMicros: 50_000n },
  { action: "message", number: 2, baseUsdMicros: 10_000n },
  { action: "offer", number: 3, baseUsdMicros: 50_000n },
];

function asAddress(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{1,64}$/.test(value)) {
    throw new Error(`${label} address is missing or invalid.`);
  }
  const n = BigInt(value);
  if (n <= 0n || n >= PRIME) throw new Error(`${label} address is outside the Starknet field.`);
  return `0x${n.toString(16)}`;
}

function positiveQuote(value, label) {
  if (typeof value !== "string" || !/^(?:0x[\da-fA-F]+|\d+)$/.test(value)) {
    throw new Error(`${label} returned an invalid quote.`);
  }
  const n = BigInt(value);
  if (n <= 0n) throw new Error(`${label} returned a zero quote.`);
  return n;
}

/** Require all three deployed helper addresses; do not substitute source defaults. */
export async function auditSepoliaFees(provider, helpers) {
  let chainId;
  try { chainId = BigInt(await provider.getChainId()); }
  catch { throw new Error("Cannot verify Starknet Sepolia RPC chain ID."); }
  if (chainId !== SEPOLIA_CHAIN_ID) throw new Error("Refusing fee audit on a non-Sepolia RPC.");

  const rows = [];
  for (const { action, number, baseUsdMicros } of ACTIONS) {
    const helper = asAddress(helpers[action], `${action} helper`);
    const policyValue = await provider.callContract({
      contractAddress: helper, entrypoint: "get_fee_policy", calldata: [],
    });
    const feePolicy = asAddress(policyValue[0], `${action} active FeePolicy`);
    const calldata = [`0x${number.toString(16)}`];
    const strkValue = await provider.callContract({
      contractAddress: feePolicy, entrypoint: "quote_fee", calldata,
    });
    const usdValue = await provider.callContract({
      contractAddress: feePolicy, entrypoint: "quote_fee_usd_micros", calldata,
    });
    const wei = positiveQuote(strkValue[0], `${action} STRK fee`);
    const usdMicros = positiveQuote(usdValue[0], `${action} USD fee`);
    if (usdMicros < baseUsdMicros) {
      throw new Error(`${action} active quote is lower than the source fee floor.`);
    }
    rows.push({ action, helper, feePolicy, wei, usdMicros, baseUsdMicros });
  }
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.env.NEXT_PUBLIC_STARKNET_NETWORK !== "sepolia") {
      throw new Error("Set NEXT_PUBLIC_STARKNET_NETWORK=sepolia; Mainnet is disallowed.");
    }
    if (!process.env.NEXT_PUBLIC_RPC_URL) {
      throw new Error("Set NEXT_PUBLIC_RPC_URL to your Starknet Sepolia RPC.");
    }
    const { RpcProvider } = await import("starknet");
    const provider = new RpcProvider({ nodeUrl: process.env.NEXT_PUBLIC_RPC_URL });
    const helpers = {
      roomActivation: process.env.NEXT_PUBLIC_INVITE_ADDRESS,
      message: process.env.NEXT_PUBLIC_MESSAGE_HELPER_ADDRESS,
      offer: process.env.NEXT_PUBLIC_OFFER_HELPER_ADDRESS,
    };
    const rows = await auditSepoliaFees(provider, helpers);
    for (const row of rows) {
      console.log(`${row.action}: active=${row.wei.toString()} STRK wei, ` +
        `USD floor=${row.usdMicros.toString()} micros, policy=${row.feePolicy}`);
    }
    console.log("Read-only Sepolia quotes verified. Compare the wallet fee separately before signing.");
    console.log("An on-chain quote >= source floor does NOT prove the new FeePolicy code is deployed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
