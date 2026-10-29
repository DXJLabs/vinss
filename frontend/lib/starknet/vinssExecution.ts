import { walletV6, type WalletAccountV6 } from "starknet";
import { CONTRACTS, NETWORK, PUBLIC_CONTRACTS, PUBLIC_FEE_POLICY_ADDRESS, PUBLIC_RAIL_ADDRESS, STRK_ADDRESS } from "./constants";
import { assertUnshieldNetwork, normalizeStarknetAddress } from "./unshield";
import { buildPublicRailCalls, type VinssAction } from "./publicRailCalls";
import { publicRailConfigurationError } from "./railConfig";
import { getProvider } from "./walletClient";
import { transactionModeOf, walletForAccount } from "./transactionMode";

type Actions = Parameters<WalletAccountV6["strk20InvokeTransaction"]>[0];
export async function assertPublicRailReady(account: WalletAccountV6): Promise<void> {
  const configError = publicRailConfigurationError();
  if (configError) throw new Error(configError);
  const wallet = walletForAccount(account) as Parameters<typeof walletV6.requestChainId>[0] | undefined;
  if (!wallet) throw new Error("Reconnect the wallet before using Unshield.");
  const provider = getProvider();
  const [walletChain, rpcChain] = await Promise.all([walletV6.requestChainId(wallet), provider.getChainId()]);
  assertUnshieldNetwork(NETWORK, walletChain, rpcChain);
  const expected = [process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS ?? "", STRK_ADDRESS,
    PUBLIC_CONTRACTS.invite, PUBLIC_CONTRACTS.messageHelper, PUBLIC_CONTRACTS.offerHelper,
    PUBLIC_CONTRACTS.privateEscrowHelper, PUBLIC_CONTRACTS.escrowRekber, PUBLIC_FEE_POLICY_ADDRESS];
  const actual = await provider.callContract({ contractAddress: PUBLIC_RAIL_ADDRESS, entrypoint: "get_configuration", calldata: [] });
  // Cairo Span serializes a length prefix.
  if (actual.length !== expected.length + 1 || BigInt(actual[0] ?? "0") !== BigInt(expected.length) ||
      expected.some((address, i) => normalizeStarknetAddress(address) !== normalizeStarknetAddress(actual[i + 1] ?? ""))) {
    throw new Error("Unshield adapter configuration does not match this deployment.");
  }
}

/** Every VINSS mutation selects one explicit execution rail. Never silently downgrade. */
export async function invokeVinssActions(account: WalletAccountV6, actions: Actions, options: { payee?: string; locatorNonce?: string; inviteClaimKey?: string } = {}) {
  if (transactionModeOf(account) === "shield") {
    return account.strk20InvokeTransaction(actions);
  }
  await assertPublicRailReady(account);
  const fields = ["invite", "messageHelper", "offerHelper", "privateEscrowHelper", "escrowRekber"] as const;
  const targetMap = new Map(fields.filter(key => CONTRACTS[key]).map(key => [normalizeStarknetAddress(CONTRACTS[key]), PUBLIC_CONTRACTS[key]]));
  const mapped: VinssAction[] = (actions as unknown as VinssAction[]).map(action => ({ ...action,
    contract: action.contract ? targetMap.get(normalizeStarknetAddress(action.contract)) ?? action.contract : undefined,
    token: action.token && [CONTRACTS.messageHelperOpenNoteToken, CONTRACTS.offerHelperOpenNoteToken].some(token => token && normalizeStarknetAddress(token) === normalizeStarknetAddress(action.token!)) ? STRK_ADDRESS : action.token,
    recipient: action.recipient ? targetMap.get(normalizeStarknetAddress(action.recipient)) ?? action.recipient : undefined,
  }));
  const calls = buildPublicRailCalls(mapped, { adapter: PUBLIC_RAIL_ADDRESS,
    treasury: process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS ?? "", feeToken: STRK_ADDRESS,
    ...PUBLIC_CONTRACTS }, options);
  return account.execute(calls);
}

export async function preflightVinssActions(account: WalletAccountV6): Promise<void> {
  if (transactionModeOf(account) === "unshield") await assertPublicRailReady(account);
}
