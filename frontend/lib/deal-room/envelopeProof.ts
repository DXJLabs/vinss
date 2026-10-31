import { constants, hash } from "starknet";
import { NETWORK, PUBLIC_RAIL_ADDRESS } from "@/lib/starknet/constants";
import { contractsForAccount } from "@/lib/starknet/railConfig";
import { transactionModeOf } from "@/lib/starknet/transactionMode";
import { getProvider } from "@/lib/starknet/walletClient";
import { shortStringToFelt, MAX_PAYLOAD_CHUNKS } from "@/lib/privacy/envelope";
export interface DiscoveryEnvelope {
    actionLocator: string;
    payloadCommitment: string;
    senderTag?: string;
    recipientTag?: string;
    ciphertextChunks: string[];
    transactionHash: string;
    blockNumber: number;
}
const PRIME = 2n ** 251n + 17n * 2n ** 192n + 1n;
export function felt(value: unknown): bigint {
    if (typeof value !== "string" || !/^(?:0x[\da-fA-F]+|\d+)$/.test(value))
        throw new Error("Invalid envelope felt.");
    const n = BigInt(value);
    if (n < 0n || n >= PRIME)
        throw new Error("Envelope felt out of range.");
    return n;
}
function same(a: unknown, b: unknown): boolean {
    try {
        return felt(a) === felt(b);
    }
    catch {
        return false;
    }
}
const verified = new Map<string, {
    expires: number;
    recoveryOnly: boolean;
}>();
/** Verify the selected helper AND the claimed successful publication; never trust indexer metadata alone. */
export async function verifyEnvelopeProof(kind: "offer" | "escrow", record: DiscoveryEnvelope, account?: object, paidCoordination = false, recoveryCustody?: string): Promise<{
    recoveryOnly: boolean;
}> {
    if (!Array.isArray(record.ciphertextChunks) || record.ciphertextChunks.length < 1 || record.ciphertextChunks.length > MAX_PAYLOAD_CHUNKS)
        throw new Error("Invalid envelope size.");
    const chunks = record.ciphertextChunks.map(felt);
    const locator = felt(record.actionLocator), sender = felt(record.senderTag), recipient = felt(record.recipientTag), commitment = felt(record.payloadCommitment);
    if (!locator || !sender || !recipient || !commitment || !felt(record.transactionHash))
        throw new Error("Empty envelope identity.");
    const envelope = [2n, locator, sender, recipient, commitment, BigInt(chunks.length)];
    const domain = kind === "offer" ? "VINSS_OFFER_COMMIT_V2" : "VINSS_PRIVATE_ESCROW_COMMIT_V2";
    const computed = hash.computePoseidonHashOnElements([shortStringToFelt(domain), 2n, locator, sender, recipient, BigInt(chunks.length), ...chunks].map(String));
    if (!same(computed, record.payloadCommitment))
        throw new Error("Ciphertext commitment mismatch.");
    const helper = kind === "offer" ? contractsForAccount(account).offerHelper : contractsForAccount(account).privateEscrowHelper;
    if (!helper)
        throw new Error("Selected ciphertext helper is not configured.");
    const provider = getProvider();
    const chain = await provider.getChainId();
    if (!same(chain, NETWORK === "mainnet" ? constants.StarknetChainId.SN_MAIN : constants.StarknetChainId.SN_SEPOLIA))
        throw new Error("Ciphertext proof RPC is on another chain.");
    const cacheKey = [chain, helper, ...envelope, record.transactionHash, record.blockNumber, paidCoordination, recoveryCustody ?? ""].join(":");
    const cached = verified.get(cacheKey);
    if (cached && cached.expires > Date.now())
        return { recoveryOnly: cached.recoveryOnly };
    const [stored, receipt] = await Promise.all([
        provider.callContract({ contractAddress: helper, entrypoint: kind === "offer" ? "get_offer_action" : "get_private_escrow_action", calldata: ["0x" + locator.toString(16)] }),
        provider.getTransactionReceipt(record.transactionHash),
    ]);
    if (stored.length !== envelope.length || stored.some((value, i) => !same(value, String(envelope[i]))))
        throw new Error("Selected helper record does not match ciphertext.");
    const r = receipt as unknown as Record<string, any>;
    if (!same(r.transaction_hash, record.transactionHash) || r.type !== "INVOKE" || r.execution_status !== "SUCCEEDED" ||
        !["ACCEPTED_ON_L1", "ACCEPTED_ON_L2"].includes(r.finality_status))
        throw new Error("Publication is not an accepted successful transaction.");
    const selector = hash.getSelectorFromName(kind === "offer" ? "OfferActionCommitted" : "PrivateEscrowActionCommitted");
    if (!Array.isArray(r.events) || !r.events.some((e: any) => same(e.from_address, helper) && e.keys?.length === 2 && same(e.keys[0], selector) && same(e.keys[1], record.actionLocator) && e.data?.length === 3 && [commitment, sender, recipient].every((n, i) => same(e.data[i], String(n)))))
        throw new Error("Publication event does not match selected helper envelope.");
    // The indexer's block label must agree with the authenticated receipt too.
    if (!Number.isSafeInteger(record.blockNumber) || record.blockNumber !== r.block_number)
        throw new Error("Publication block mismatch.");
    let recoveryOnly = false;
    if (paidCoordination && transactionModeOf(account) === "unshield") {
        let trace: Record<string, any> = {};
        try {
            trace = await provider.getTransactionTrace(record.transactionHash) as unknown as Record<string, any>;
        }
        catch { /* Existing funded custody may still be recovered below. */ }
        const expected = [BigInt(envelope.length + chunks.length), ...envelope, ...chunks, 10n ** 18n];
        const selector = hash.getSelectorFromName("post_escrow_action");
        function matches(call: any): boolean {
            if (!call || typeof call !== "object")
                return false;
            if (same(call.contract_address, PUBLIC_RAIL_ADDRESS) && same(call.entry_point_selector, selector) && Array.isArray(call.calldata) &&
                call.calldata.length === expected.length + 1 && expected.every((n, i) => same(call.calldata[i], String(n))))
                return true;
            return Array.isArray(call.calls) && call.calls.some(matches);
        }
        if (!matches(trace.execute_invocation)) {
            if (!recoveryCustody || !felt(recoveryCustody))
                throw new Error("Paid Escrow coordination has no exact fee-bearing adapter invocation.");
            const exists = await provider.callContract({ contractAddress: contractsForAccount(account).escrowRekber, entrypoint: "custody_exists", calldata: [recoveryCustody] });
            if (exists.length !== 1 || !same(exists[0], "1"))
                throw new Error("Unpaid coordination cannot authorize a new custody workflow.");
            // This is visibility for existing funds, never authorization to accept/fund a new agreement.
            recoveryOnly = true;
        }
    }
    if (verified.size >= 256)
        verified.delete(verified.keys().next().value!);
    verified.set(cacheKey, { expires: Date.now() + 30000, recoveryOnly });
    return { recoveryOnly };
}
