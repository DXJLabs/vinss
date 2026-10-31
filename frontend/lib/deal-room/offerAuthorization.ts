import { constants, num, verifyMessageInStarknet, type Signature, type TypedData, type WalletAccountV6 } from "starknet";
import type { OfferActionPayload } from "@/types/deal-room";
import { NETWORK } from "@/lib/starknet/constants";
import { contractsForAccount } from "@/lib/starknet/railConfig";
import { transactionModeOf } from "@/lib/starknet/transactionMode";
import { getProvider } from "@/lib/starknet/walletClient";
import { sameStarknetAddress } from "@/lib/privacy/participantKeys";
export interface OfferAuthorship {
    version: 1;
    signature: string[];
}
export function canonicalOfferValue(value: unknown): unknown {
    if (Array.isArray(value))
        return value.map(canonicalOfferValue);
    if (value && typeof value === "object")
        return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonicalOfferValue(v)]));
    return value;
}
export async function buildOfferTypedData(action: OfferActionPayload, locator: bigint, account?: object): Promise<TypedData> {
    const { authorship: _, ...body } = action;
    if (!action.senderAddress || !action.recipientAddress || !["create", "counter", "accept", "reject", "cancel", "expire"].includes(action.kind) ||
        typeof action.asset !== "string" || typeof action.amount !== "string" || typeof action.paymentTerms !== "string")
        throw new Error("Invalid signed Offer payload.");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonicalOfferValue(body))));
    const commitment = BigInt("0x" + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("")) % (2n ** 251n + 17n * 2n ** 192n + 1n);
    return { types: {
            StarknetDomain: [{ name: "name", type: "shortstring" }, { name: "version", type: "shortstring" }, { name: "chainId", type: "shortstring" }, { name: "revision", type: "shortstring" }],
            OfferAction: [{ name: "Helper", type: "ContractAddress" }, { name: "Rail", type: "shortstring" }, { name: "Locator", type: "felt" }, { name: "Sender", type: "ContractAddress" }, { name: "Recipient", type: "ContractAddress" }, { name: "Payload", type: "felt" }],
        }, primaryType: "OfferAction", domain: { name: "VINSS Offer", version: "1", chainId: NETWORK === "mainnet" ? constants.StarknetChainId.SN_MAIN : constants.StarknetChainId.SN_SEPOLIA, revision: "1" },
        message: { Helper: num.toHex(contractsForAccount(account).offerHelper), Rail: transactionModeOf(account), Locator: num.toHex(locator), Sender: num.toHex(action.senderAddress), Recipient: num.toHex(action.recipientAddress), Payload: num.toHex(commitment) } };
}
export async function signOfferAction(account: WalletAccountV6, action: OfferActionPayload, locator: bigint): Promise<OfferActionPayload> {
    if (!sameStarknetAddress(action.senderAddress, account.address))
        throw new Error("Offer sender must be the connected wallet.");
    const signature = await account.signMessage(await buildOfferTypedData(action, locator, account)) as Signature;
    const values = Array.isArray(signature) ? signature : [signature.r, signature.s];
    return { ...action, authorship: { version: 1, signature: values.map(value => num.toHex(value)) } };
}
export async function verifyOfferAuthorship(action: OfferActionPayload, locator: bigint, account?: object): Promise<boolean> {
    try {
        if (action.authorship?.version !== 1 || !Array.isArray(action.authorship.signature) || !action.authorship.signature.length || action.authorship.signature.length > 128)
            return false;
        return await verifyMessageInStarknet(getProvider(), await buildOfferTypedData(action, locator, account), action.authorship.signature, action.senderAddress!);
    }
    catch {
        return false;
    }
}
