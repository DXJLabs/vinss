/** Pure translation of VINSS intents to typed public-adapter calls. No wallet API calls. */
import { normalizeStarknetAddress } from "./unshield.ts";
export interface VinssAction { type: string; contract?: string; token?: string; recipient?: string; amount?: string; calldata?: readonly string[]; }
export interface PublicRailConfig { adapter: string; treasury: string; feeToken: string; invite: string; messageHelper: string; offerHelper: string; privateEscrowHelper: string; escrowRekber: string; }
export interface RailCall { contractAddress: string; entrypoint: string; calldata: string[]; }
const MAX_U128 = (1n << 128n) - 1n;
const hex = (n: bigint) => "0x" + n.toString(16);
function numeric(value: string): bigint {
  if (!/^(?:0x[\da-fA-F]+|\d+)$/.test(value)) throw new Error("Invalid public rail integer.");
  return BigInt(value);
}
export function publicInvokePayload(action: VinssAction): string[] {
  const data = action.calldata;
  if (!data?.length || numeric(data[0]!) !== BigInt(data.length - 1)) throw new Error("Invalid VINSS invoke envelope length.");
  return data.slice(1).map(value => /^\$\{openNoteIds\[\d+\]\}$/.test(value) ? "0x1" : hex(numeric(value)));
}
export function buildPublicRailCalls(actions: readonly VinssAction[], config: PublicRailConfig,
  options: { payee?: string; locatorNonce?: string; inviteClaimKey?: string } = {}): RailCall[] {
  const adapter = normalizeStarknetAddress(config.adapter);
  const treasury = normalizeStarknetAddress(config.treasury);
  const feeToken = normalizeStarknetAddress(config.feeToken);
  const targets = new Map<string,string>([
    [config.invite, "create_invite"], [config.messageHelper, "post_message"],
    [config.offerHelper, "post_offer"], [config.privateEscrowHelper, "post_escrow_action"], [config.escrowRekber, "act_custody"],
  ].map(([address, entrypoint]) => [normalizeStarknetAddress(address!), entrypoint!]));
  if (targets.size !== 5) throw new Error("Public helper targets must be distinct.");
  const allowances = new Map<string,bigint>();
  const directFees: RailCall[] = [];
  const calls: RailCall[] = [];
  const invokes = actions.filter(action => action.type === "invoke");
  for (const action of actions) {
    if (action.type === "invoke") continue;
    if (action.type === "transfer" && action.amount === "OPEN") continue; // Adapter fixes every output recipient onchain.
    if (action.type !== "withdraw" || !action.token || !action.recipient || !action.amount) throw new Error("Unsupported public VINSS intent.");
    const amount = numeric(action.amount);
    if (amount <= 0n || amount > MAX_U128) throw new Error("Invalid public funding amount.");
    const token = normalizeStarknetAddress(action.token), recipient = normalizeStarknetAddress(action.recipient);
    if (recipient === treasury) {
      if (token !== feeToken) throw new Error("Invalid workflow fee token.");
      if (invokes.length) {
        // Rekber's typed adapter enforces workflow charges; legacy dust has no public counterpart.
        if (amount !== 10n && amount !== 10n ** 18n) throw new Error("Unsupported public workflow fee.");
      } else {
        if (amount !== 10n ** 18n) throw new Error("Unsupported public workflow fee.");
        directFees.push({ contractAddress: token, entrypoint: "transfer", calldata: [treasury, hex(amount), "0x0"] });
      }
    } else {
      if (!targets.has(recipient)) throw new Error("Funding target is not a VINSS helper.");
      allowances.set(token, (allowances.get(token) ?? 0n) + amount);
    }
  }
  for (const action of invokes) {
    const target = normalizeStarknetAddress(action.contract ?? "");
    let entrypoint = targets.get(target);
    if (!entrypoint) throw new Error("Public rail refuses an unregistered contract.");
    const payload = publicInvokePayload(action);
    let suffix: string[] = [];
    if (entrypoint === "create_invite") {
      if (numeric(payload[0]!) !== 0n) throw new Error("Public invite consumption requires a signed capability.");
      const claimKey = numeric(options.inviteClaimKey ?? "0");
      if (!claimKey) throw new Error("Missing public invite claim key.");
      suffix = [hex(claimKey)];
    }
    if (entrypoint === "post_message" || entrypoint === "post_offer") {
      const nonce = numeric(options.locatorNonce ?? "0");
      if (!nonce) throw new Error("Missing actor-bound public locator nonce.");
      suffix = [hex(nonce)];
    }
    if (entrypoint === "post_escrow_action") {
      const fee = actions.find(a => a.type === "withdraw" && a.recipient && normalizeStarknetAddress(a.recipient) === treasury);
      const amount = fee?.amount ? numeric(fee.amount) : 0n;
      const workflowFee = amount === 10n ? 0n : amount;
      if (workflowFee !== 0n && workflowFee !== 10n ** 18n) throw new Error("Invalid Rekber workflow fee.");
      const nonce = numeric(options.locatorNonce ?? "0");
      if (!nonce) throw new Error("Missing actor-bound public locator nonce.");
      suffix = [hex(workflowFee), hex(nonce)];
      if (workflowFee) allowances.set(feeToken, (allowances.get(feeToken) ?? 0n) + workflowFee);
    }
    if (entrypoint === "act_custody") {
      const operation = numeric(payload[0]!);
      if (operation === 1n) {
        entrypoint = "fund_custody";
        suffix = [normalizeStarknetAddress(options.payee ?? "")];
      } else if (operation === 4n || operation === 6n || operation === 10n ||
                 ((operation === 5n || operation === 7n) && !invokes.some(a => a.contract && normalizeStarknetAddress(a.contract) === normalizeStarknetAddress(config.messageHelper)))) {
        allowances.set(feeToken, (allowances.get(feeToken) ?? 0n) + 10n ** 18n);
      }
    }
    calls.push({ contractAddress: adapter, entrypoint, calldata: [hex(BigInt(payload.length)), ...payload, ...suffix] });
  }
  const approvals = [...allowances].map(([token, amount]) => {
    if (amount > MAX_U128) throw new Error("Public funding exceeds u128.");
    return { contractAddress: token, entrypoint: "approve", calldata: [adapter, hex(amount), "0x0"] };
  });
  // Clear any residual allowance in the same atomic account multicall.
  const revoke = [...allowances].map(([token]) => ({ contractAddress: token, entrypoint: "approve", calldata: [adapter, "0x0", "0x0"] }));
  if (!calls.length && !directFees.length) throw new Error("Empty public VINSS operation.");
  return [...approvals, ...directFees, ...calls, ...revoke];
}
