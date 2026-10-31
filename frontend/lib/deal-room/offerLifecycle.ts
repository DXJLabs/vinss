import { canonicalOfferValue } from "./offerAuthorization";
import type { OfferActionPayload } from "@/types/deal-room";
import { sameStarknetAddress } from "@/lib/privacy/participantKeys";
interface Record {
    actionLocator: string;
    action: OfferActionPayload;
    authorshipVerified: boolean;
}
const locator = (value: string) => BigInt(value.startsWith("0x") ? value : "0x" + value).toString(16);
/** A signed acceptance must come from the recipient of authenticated parent terms. */
export function validOfferLifecycle(records: Record[]): Set<string> {
    const byLocator = new Map(records.map(r => [BigInt(r.actionLocator).toString(16), r]));
    const valid = new Set<string>(), visiting = new Set<string>();
    function visit(key: string): boolean {
        if (valid.has(key))
            return true;
        if (visiting.has(key))
            return false;
        const record = byLocator.get(key);
        if (!record?.authorshipVerified)
            return false;
        const action = record.action;
        visiting.add(key);
        let ok = false;
        try {
            if (action.kind === "create")
                ok = !action.parentOfferLocator && !action.rootOfferLocator;
            else if (action.parentOfferLocator) {
                const parentKey = locator(action.parentOfferLocator), parent = byLocator.get(parentKey)?.action;
                if (parent && visit(parentKey) && ["create", "counter"].includes(parent.kind)) {
                    const root = parent.rootOfferLocator ? locator(parent.rootOfferLocator) : parentKey;
                    const reverse = sameStarknetAddress(action.senderAddress, parent.recipientAddress) && sameStarknetAddress(action.recipientAddress, parent.senderAddress);
                    const forward = sameStarknetAddress(action.senderAddress, parent.senderAddress) && sameStarknetAddress(action.recipientAddress, parent.recipientAddress);
                    ok = Boolean(action.rootOfferLocator && locator(action.rootOfferLocator) === root) &&
                        (["counter", "accept", "reject"].includes(action.kind) ? reverse : action.kind === "cancel" ? forward : action.kind === "expire" && (forward || reverse));
                    // Counter may negotiate terms, but never silently swap immutable custody roles.
                    if (ok && action.kind === "counter")
                        ok = JSON.stringify(canonicalOfferValue(action.settlementPlan)) === JSON.stringify(canonicalOfferValue(parent.settlementPlan));
                    if (ok && action.kind === "accept")
                        ok = (["asset", "amount", "paymentTerms", "conditions", "expiresAt", "dealType", "settlementPlan"] as const).every(field => JSON.stringify(canonicalOfferValue(action[field])) === JSON.stringify(canonicalOfferValue(parent[field])));
                    if (ok && action.kind === "expire")
                        ok = Boolean(parent.expiresAt && Number.isFinite(Date.parse(parent.expiresAt)) && Date.now() >= Date.parse(parent.expiresAt));
                }
            }
        }
        catch {
            ok = false;
        }
        visiting.delete(key);
        if (ok)
            valid.add(key);
        return ok;
    }
    for (const key of byLocator.keys())
        visit(key);
    return valid;
}
/** Unsigned history is display-only: it cannot supersede a verified parent's controls. */
export function supersededOfferParents(entries: Array<{
    offerAction?: OfferActionPayload;
    offerAuthorshipVerified?: boolean;
}>): Set<string> {
    return new Set(entries.filter(entry => entry.offerAuthorshipVerified === true && entry.offerAction?.parentOfferLocator)
        .map(entry => entry.offerAction!.parentOfferLocator!.replace(/^0x/, "").toLowerCase()));
}
