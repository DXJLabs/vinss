import { walletV6, type WalletAccountV6, type STRK20_ACTION } from "starknet";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard-v6/features";
import { CONTRACTS, NETWORK, RPC_URL } from "./constants";
import { NETWORKS, assertChainId, readRpcChainId, sameFelt } from "./network";
import { assertHelperCompatibility, assertHelperPool } from "./contractCompatibility";
import { getProvider } from "./walletClient";

export async function assertWalletNetwork(account: WalletAccountV6): Promise<void> {
  // Wallet API actions have no pool-address argument. Only use the verified
  // canonical pool for this network; an arbitrary configured pool cannot be
  // assumed to be the pool selected internally by the wallet.
  if (!sameFelt(CONTRACTS.privacyPool, NETWORKS[NETWORK].privacyPool)) {
    throw new Error("Configured privacy pool does not match the supported STRK20 wallet pool.");
  }
  const wallet = account.walletProvider as unknown as WalletWithStarknetFeatures;
  const [walletChain, rpcChain, accounts] = await Promise.all([
    walletV6.requestChainId(wallet),
    readRpcChainId(RPC_URL),
    walletV6.requestAccounts(wallet, true),
  ]);
  assertChainId(NETWORK, walletChain, "Wallet");
  assertChainId(NETWORK, rpcChain, "RPC");
  if (!accounts[0] || !sameFelt(accounts[0], account.address)) {
    throw new Error("Wallet account changed. Reconnect before continuing.");
  }
}

function requiredFunctions(address: string): string[] {
  const methods = ["privacy_invoke", "get_privacy_pool"];
  if ([CONTRACTS.messageHelper, CONTRACTS.offerHelper, CONTRACTS.invite]
    .some((helper) => helper && sameFelt(address, helper))) {
    methods.push("get_fee_policy");
  }
  if (sameFelt(address, CONTRACTS.escrowRekber)) {
    methods.push("quote_rekber_fee", "get_revenue_fee_policy", "get_custody");
  }
  return methods;
}

const abiByClass = new Map<string, unknown>();

async function deployedAbi(address: string): Promise<unknown> {
  if (!address) throw new Error("VINSS contract is not configured for this network.");
  const provider = getProvider();
  // Detect upgrades as well as an accidental endpoint change; never cache only
  // by address. Pool binding is read again on every submission.
  const classHash = await provider.getClassHashAt(address, "latest");
  let abi = abiByClass.get(classHash);
  if (!abi) {
    abi = (await provider.getClassAt(address, "latest")).abi;
    abiByClass.set(classHash, abi);
  }
  return abi;
}

export async function assertHelperReady(address: string): Promise<void> {
  const provider = getProvider();
  const abi = await deployedAbi(address);
  assertHelperCompatibility(abi, requiredFunctions(address), "VINSS helper");
  const pool = await provider.callContract({
    contractAddress: address, entrypoint: "get_privacy_pool", calldata: [],
  }, "latest");
  assertHelperPool(pool[0] ?? "", CONTRACTS.privacyPool);
}

export async function assertCertificateReady(): Promise<void> {
  const address = CONTRACTS.settlementCertificate;
  const abi = await deployedAbi(address);
  assertHelperCompatibility(abi, ["claim", "get_escrow_rekber"], "Settlement certificate");
  const rekber = await getProvider().callContract({
    contractAddress: address, entrypoint: "get_escrow_rekber", calldata: [],
  }, "latest");
  if (!sameFelt(rekber[0] ?? "", CONTRACTS.escrowRekber)) {
    throw new Error("Settlement certificate is bound to a different Rekber deployment.");
  }
  await assertHelperReady(CONTRACTS.escrowRekber);
}

/** All Chat, Offer and Escrow STRK20 submissions share this boundary. */
export async function invokeShieldedTransaction(
  account: WalletAccountV6,
  actions: STRK20_ACTION[],
): Promise<{ transaction_hash: string }> {
  await assertWalletNetwork(account);
  const helpers = [...new Set(actions.flatMap((action) =>
    action.type === "invoke" ? [action.contract] : []))];
  const allowed = [CONTRACTS.messageHelper, CONTRACTS.offerHelper,
    CONTRACTS.privateEscrowHelper, CONTRACTS.escrowRekber, CONTRACTS.invite];
  for (const helper of helpers) {
    if (!allowed.some((address) => address && sameFelt(address, helper))) {
      throw new Error("STRK20 invoke targets an unconfigured VINSS contract.");
    }
    await assertHelperReady(helper);
  }
  // Recheck after asynchronous preparation: the user may switch in the wallet.
  await assertWalletNetwork(account);
  return account.strk20InvokeTransaction(actions);
}
