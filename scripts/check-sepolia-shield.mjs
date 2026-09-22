/** Read-only checks of existing deployments. Never signs, submits or deploys. */
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { hash } = require("starknet");
const profile = JSON.parse(await readFile(new URL("../config/sepolia-deployments.json", import.meta.url), "utf8"));
const rpcUrl = process.env.SEPOLIA_RPC_URL ?? "https://api.cartridge.gg/x/starknet/sepolia";
async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`RPC error ${body.error.code}: ${body.error.message}`);
  return body.result;
}
const chainId = await rpc("starknet_chainId", []);
if (BigInt(chainId) !== BigInt(profile.chainId)) throw new Error("RPC is not Sepolia; refusing to continue.");
const blockNumber = await rpc("starknet_blockNumber", []);
const block_id = { block_number: blockNumber };
const call = (address, method, calldata = []) => rpc("starknet_call", {
  block_id, request: { contract_address: address, entry_point_selector: hash.getSelectorFromName(method), calldata },
});
const requirements = {
  VinssMessageHelper: ["privacy_invoke", "get_privacy_pool", "get_fee_policy"],
  VinssOfferHelper: ["privacy_invoke", "get_privacy_pool", "get_fee_policy"],
  VinssInvite: ["privacy_invoke", "get_privacy_pool", "get_fee_policy"],
  VinssPrivateEscrowHelper: ["privacy_invoke", "get_privacy_pool"],
  VinssEscrowRekber: ["privacy_invoke", "get_privacy_pool", "quote_rekber_fee", "get_revenue_fee_policy", "get_custody"],
  VinssFeePolicy: ["quote_fee", "quote_fee_usd_micros"],
  VinssSettlementCertificate: ["claim", "is_claimed", "get_escrow_rekber"],
};
const contracts = await Promise.all(Object.entries(profile.contracts).map(async ([name, address]) => {
  const deployment = profile.deployments[name];
  const [contract, classHash, receipt] = await Promise.all([
    rpc("starknet_getClassAt", { block_id, contract_address: address }),
    rpc("starknet_getClassHashAt", { block_id, contract_address: address }),
    rpc("starknet_getTransactionReceipt", { transaction_hash: deployment.deploymentTransaction }),
  ]);
  const abi = typeof contract.abi === "string" ? JSON.parse(contract.abi) : contract.abi;
  const functions = abi.flatMap((entry) => [entry, ...(entry.items ?? [])])
    .filter((entry) => entry.type === "function").map((entry) => entry.name);
  const bindings = [];
  async function binding(method, expected) {
    const actual = (await call(address, method))[0];
    bindings.push({ method, expected, actual, matches: BigInt(actual) === BigInt(expected) });
  }
  if (functions.includes("get_privacy_pool")) await binding("get_privacy_pool", profile.privacyPool);
  if (["VinssMessageHelper", "VinssOfferHelper", "VinssInvite"].includes(name)) {
    await binding("get_fee_policy", profile.contracts.VinssFeePolicy);
  }
  if (name === "VinssEscrowRekber") await binding("get_revenue_fee_policy", profile.contracts.VinssFeePolicy);
  if (name === "VinssSettlementCertificate") await binding("get_escrow_rekber", profile.contracts.VinssEscrowRekber);
  return { name, address, classHash, source: deployment.source,
    deploymentTransaction: deployment.deploymentTransaction,
    deploymentBlock: receipt.block_number, deploymentSucceeded: receipt.execution_status === "SUCCEEDED",
    bindings, missingFunctions: requirements[name].filter((fn) => !functions.includes(fn)), functions };
}));
const feeQuotes = [];
for (const [label, address, method, calldata] of [
  ["roomActivation", profile.contracts.VinssFeePolicy, "quote_fee", ["0x1"]],
  ["message", profile.contracts.VinssFeePolicy, "quote_fee", ["0x2"]],
  ["offer", profile.contracts.VinssFeePolicy, "quote_fee", ["0x3"]],
  ["rekberForOneStrk", profile.contracts.VinssEscrowRekber, "quote_rekber_fee", [profile.tokens.STRK, "0xde0b6b3a7640000"]],
]) {
  try {
    const amount = (await call(address, method, calldata))[0];
    feeQuotes.push({ label, amount, positive: BigInt(amount) > 0n });
  } catch (error) {
    feeQuotes.push({ label, positive: false, error: error.message });
  }
}
const compatible = contracts.every((item) => item.deploymentSucceeded &&
  item.bindings.every((binding) => binding.matches) && !item.missingFunctions.length);
const treasury = process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS;
let treasuryRegistration = { status: "not configured" };
if (treasury) {
  const publicKey = (await call(profile.privacyPool, "get_public_key", [treasury]))[0];
  treasuryRegistration = { address: treasury, publicKey, status: BigInt(publicKey) > 0n ? "registered" : "not registered" };
}
const report = { checkedAt: new Date().toISOString(), chainId, blockNumber,
  source: profile.source, compatible, feeQuotesAvailable: feeQuotes.every((quote) => quote.positive),
  contracts, feeQuotes, treasuryRegistration, liveAliceBobSettlement: "not run" };
const output = process.argv[2];
if (output) await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
// Compatibility and positive quotes are not proof of native Alice/Bob settlement.
process.exitCode = compatible && report.feeQuotesAvailable ? 0 : 2;
