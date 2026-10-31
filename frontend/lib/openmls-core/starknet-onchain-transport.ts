"use client";
import type { WalletAccountV6 } from "starknet";
import { discoverMessages, sendMessage } from "@/lib/deal-room/messageGateway";
import { canonicalStarknetAddress } from "@/lib/privacy/participantKeys";
import { accountForMode, transactionModeOf, type TransactionMode } from "@/lib/starknet/transactionMode";
import { backendForAccount, publicRailConfigurationError } from "@/lib/starknet/railConfig";
import { observeWalletOutcome, waitForWalletPreparation } from "@/lib/deal-room/walletPreparation";
import type { MessageRoute } from "@/lib/privacy/messageRouting";
import type { MessagePayload, MessageScope } from "@/types/deal-room";
import { frameStarknetMlsPacket, MLS_WIRE_PREFIX, parseStarknetMlsFrame, reassembleStarknetMlsFrames, type StarknetMlsPacket, type StarknetMlsPacketKind } from "./starknet-framing";
export interface StarknetMlsOnchainContext {
    account: WalletAccountV6;
    network: string;
    roomId: string;
    groupId?: string;
    scope: MessageScope;
    encryptionKey: Uint8Array;
    messagingPublicKey: string;
    outboundRoute?: MessageRoute;
    inboundRoutes?: MessageRoute[];
    backendUrl: string;
}
export interface MlsReceipt {
    actionLocator: string;
    payloadCommitment: string;
    transactionHash: string;
    blockNumber: number;
}
export interface ConfirmedMlsPacket extends StarknetMlsPacket {
    receipts: MlsReceipt[];
    blockNumber: number;
}
export interface PendingMlsFrame {
    body: string;
    prepared?: {
        actionLocator: string;
        payloadCommitment: string;
    };
    transactionHash?: string;
    receipt?: MlsReceipt;
}
export interface MlsPacketPlan {
    kind: StarknetMlsPacketKind;
    bytes: number[];
    mode: TransactionMode;
    frames: PendingMlsFrame[];
    approved?: boolean;
}
interface VerifiedFrame {
    body: string;
    packetId: string;
    index: number;
    sender: string;
    receipt: MlsReceipt;
}
/** Read both configured Starknet rails; every frame is independently anchored to its selected helper. */
export async function readVerifiedMlsFrames(ctx: StarknetMlsOnchainContext): Promise<VerifiedFrame[]> {
    if (ctx.scope === "direct" && !ctx.inboundRoutes?.length)
        throw new Error("MLS Direct requires explicit private routes.");
    const contexts = [{ account: ctx.account, url: ctx.backendUrl }];
    const other = accountForMode(ctx.account, transactionModeOf(ctx.account) === "shield" ? "unshield" : "shield");
    const otherUrl = backendForAccount(other);
    if (otherUrl && (transactionModeOf(other) === "shield" || !publicRailConfigurationError()))
        contexts.push({ account: other, url: otherUrl });
    const results = await Promise.allSettled(contexts.map(async (context) => {
        const records = await discoverMessages(context.url, ctx.encryptionKey, ctx.scope === "direct" ? ctx.inboundRoutes : undefined, { account: context.account, verifyPublication: true });
        const frames: VerifiedFrame[] = [];
        for (const record of records) {
            const message = record.message;
            if (message.kind !== "system_note" || message.scope !== ctx.scope || (ctx.scope === "group" && message.groupId !== ctx.groupId) || !message.body.startsWith(MLS_WIRE_PREFIX))
                continue;
            try {
                const frame = parseStarknetMlsFrame(message.body);
                if (!frame || frame.network !== ctx.network || frame.roomId !== ctx.roomId || frame.sender !== canonicalStarknetAddress(message.senderIdentity?.address ?? ""))
                    continue;
                frames.push({ body: message.body, packetId: frame.packetId, index: frame.index, sender: frame.sender, receipt: { actionLocator: record.actionLocator, payloadCommitment: record.payloadCommitment, transactionHash: record.transactionHash, blockNumber: record.blockNumber } });
            }
            catch { /* Unrelated or malformed packets never become MLS state. */ }
        }
        return frames;
    }));
    if (results.every(result => result.status === "rejected"))
        throw new Error("MLS ciphertext discovery is unavailable.");
    return results.flatMap(result => result.status === "fulfilled" ? result.value : []).sort((a, b) => a.receipt.blockNumber - b.receipt.blockNumber);
}
export async function readStarknetMlsOnchain(ctx: StarknetMlsOnchainContext) {
    const frames = await readVerifiedMlsFrames(ctx);
    const result = await reassembleStarknetMlsFrames(frames.map(frame => frame.body), { network: ctx.network, roomId: ctx.roomId });
    const complete: ConfirmedMlsPacket[] = result.complete.map(packet => {
        const parts = frames.filter(frame => frame.packetId === packet.packetId && frame.sender === packet.sender);
        const unique = new Map(parts.map(part => [part.index, part.receipt]));
        return { ...packet, receipts: [...unique].sort(([a], [b]) => a - b).map(([, receipt]) => receipt), blockNumber: Math.max(...parts.map(part => part.receipt.blockNumber)) };
    });
    return { ...result, complete };
}
export async function prepareStarknetMlsPacket(ctx: StarknetMlsOnchainContext, kind: StarknetMlsPacketKind, bytes: Uint8Array): Promise<MlsPacketPlan> {
    const bodies = await frameStarknetMlsPacket({ kind, bytes, network: ctx.network, roomId: ctx.roomId, sender: canonicalStarknetAddress(ctx.account.address) });
    return { kind, bytes: Array.from(bytes), mode: transactionModeOf(ctx.account), frames: bodies.map(body => ({ body })) };
}
/** Durable plan is saved before prompts. A prepared ambiguous frame is only reconciled, never silently resubmitted. */
export async function sendStarknetMlsOnchain(ctx: StarknetMlsOnchainContext, plan: MlsPacketPlan, persist: () => Promise<void>, confirmMultiple: (count: number, kind: string) => Promise<boolean>): Promise<ConfirmedMlsPacket> {
    if (plan.mode !== transactionModeOf(ctx.account))
        throw new Error("MLS pending packet belongs to another transaction mode. Switch back to resume it.");
    if (!plan.approved) {
        if (plan.frames.length > 1 && !await confirmMultiple(plan.frames.length, plan.kind))
            throw new Error("MLS multi-transaction publication was not approved.");
        plan.approved = true;
        await persist();
    }
    for (const part of plan.frames) {
        if (part.receipt)
            continue;
        const find = async () => {
            const records = await readVerifiedMlsFrames(ctx);
            return records.find(record => record.body === part.body && (!part.prepared || BigInt(record.receipt.actionLocator) === BigInt(part.prepared.actionLocator)))?.receipt;
        };
        if (part.prepared) {
            const existing = await find();
            if (!existing)
                throw new Error("MLS frame is awaiting its original transaction proof. Sync before retrying; no duplicate was submitted.");
            part.receipt = existing;
            await persist();
            continue;
        }
        const payload: MessagePayload = { kind: "system_note", scope: ctx.scope, body: part.body, senderIdentity: { address: ctx.account.address, messagingPublicKey: ctx.messagingPublicKey }, sentAt: new Date().toISOString(), ...(ctx.scope === "direct" ? { recipientAddress: ctx.outboundRoute!.recipientIdentity } : { groupId: ctx.groupId }) };
        let prepared!: () => void;
        const ready = new Promise<void>(resolve => { prepared = resolve; });
        const walletPromise = sendMessage(ctx.account, ctx.encryptionKey, payload, ctx.outboundRoute, async (value) => {
            part.prepared = { actionLocator: value.actionLocator.toString(), payloadCommitment: value.payloadCommitment.toString() };
            await persist();
            prepared();
        });
        const outcome = observeWalletOutcome(walletPromise);
        await waitForWalletPreparation(ready, outcome);
        const poll = async () => {
            for (let attempt = 0; attempt < 20; attempt++) {
                const found = await find().catch(() => undefined);
                if (found)
                    return found;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            return undefined;
        };
        const proof = poll();
        const first = await Promise.race([outcome, proof.then(receipt => ({ kind: "proof" as const, receipt }))]);
        if (first.kind === "wallet") {
            part.transactionHash = first.result.transactionHash;
            await persist();
        }
        const receipt = first.kind === "proof" ? first.receipt : await proof;
        if (!receipt)
            throw new Error("MLS frame is not confirmed on-chain yet. Resume this pending packet instead of sending it again.");
        part.receipt = receipt;
        await persist();
    }
    const packet = parseStarknetMlsFrame(plan.frames[0]!.body)!;
    const receipts = plan.frames.map(frame => frame.receipt!);
    return { kind: plan.kind, network: ctx.network, roomId: ctx.roomId, sender: packet.sender, packetId: packet.packetId, bytes: Uint8Array.from(plan.bytes), receipts, blockNumber: Math.max(...receipts.map(receipt => receipt.blockNumber)) };
}
