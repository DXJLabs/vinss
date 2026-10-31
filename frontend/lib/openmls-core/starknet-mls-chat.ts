"use client";
import { num, verifyMessageInStarknet, type Signature, type WalletAccountV6 } from "starknet";
import { getProvider } from "@/lib/starknet/walletClient";
import { canonicalStarknetAddress } from "@/lib/privacy/participantKeys";
import { createStarknetOpenMlsSession, type StarknetOpenMlsSessionInput } from "./starknet-session";
import { prepareStarknetMlsPacket, readStarknetMlsOnchain, sendStarknetMlsOnchain, type ConfirmedMlsPacket, type MlsPacketPlan, type MlsReceipt, type StarknetMlsOnchainContext } from "./starknet-onchain-transport";
import type { BrowserOpenMlsBridge } from "./openmls/browser-bridge";
import type { GroupMember } from "./types";
import { createSignedMlsKeyPackage, verifySignedMlsKeyPackage, signMlsWelcome, verifyMlsWelcome, type SignedMlsKeyPackage, type SignedMlsWelcome, type MlsWalletVerifier } from "./starknet-keypackage-attestation";
export interface MlsPlaintextMessage {
    version: 1;
    type: "message";
    from: string;
    to: string;
    sentAt: number;
    body: string;
}
export interface MlsInboxMessage {
    packetId: string;
    sender: string;
    message: MlsPlaintextMessage;
    receipts: MlsReceipt[];
}
interface PendingApplication {
    message: MlsPlaintextMessage;
    ciphertext: number[];
}
interface State {
    version: 1;
    conversationId: string;
    inbox: MlsInboxMessage[];
    pendingApplication?: PendingApplication;
    pendingTransport?: MlsPacketPlan;
    keyPackagePublished?: boolean;
    keyPackageExpiresAt?: number;
    peerInstallationId?: string;
}
const encoder = new TextEncoder(), decoder = new TextDecoder("utf-8", { fatal: true });
const encode = (value: unknown) => encoder.encode(JSON.stringify(value));
function decode<T>(bytes: Uint8Array): T { if (bytes.length > 64 * 1024)
    throw new Error("MLS packet is too large."); return JSON.parse(decoder.decode(bytes)); }
function signature(value: Signature): string[] { return (Array.isArray(value) ? value : [value.r, value.s]).map(item => num.toHex(item)); }
function member(scope: StarknetOpenMlsSessionInput, role: "admin" | "member"): GroupMember {
    const installationId = [scope.chainId, scope.roomId, canonicalStarknetAddress(scope.walletAddress), scope.installationId].join(":");
    return { userId: canonicalStarknetAddress(scope.walletAddress), installationId, credential: encoder.encode(installationId), role };
}
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((value, index) => value === b[index]);
export async function directMlsConversationId(chain: string, room: string, a: string, b: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", encode(["VINSS_OPENMLS_DIRECT_V2", chain, room, ...[canonicalStarknetAddress(a), canonicalStarknetAddress(b)].sort()]));
    return "vinss-mls-" + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 48);
}
/** One durable MLS state machine per wallet/device/peer, independent from the selected transaction rail. */
export class StarknetOpenMlsChat {
    private queue: Promise<unknown> = Promise.resolve();
    private state: State;
    private constructor(readonly bridge: BrowserOpenMlsBridge, readonly ownScope: StarknetOpenMlsSessionInput, readonly transport: StarknetMlsOnchainContext, readonly peerAddress: string, readonly conversationId: string) {
        const raw = bridge.readApplicationState();
        this.state = raw ? JSON.parse(decoder.decode(raw)) : { version: 1, conversationId, inbox: [] };
        if (this.state.version !== 1 || this.state.conversationId !== conversationId || !Array.isArray(this.state.inbox))
            throw new Error("MLS checkpoint application scope mismatch.");
    }
    static async initialize(input: {
        identity: StarknetOpenMlsSessionInput;
        peerAddress: string;
        transport: StarknetMlsOnchainContext;
        sessionFactory?: (identity: StarknetOpenMlsSessionInput) => Promise<BrowserOpenMlsBridge>;
    }): Promise<StarknetOpenMlsChat> {
        const peer = canonicalStarknetAddress(input.peerAddress), own = canonicalStarknetAddress(input.identity.walletAddress);
        if (input.identity.chainId !== input.transport.network || input.identity.roomId !== input.transport.roomId || own !== canonicalStarknetAddress(input.transport.account.address) || !peer || peer === own || input.transport.scope !== "direct" || canonicalStarknetAddress(input.transport.outboundRoute?.recipientIdentity ?? "") !== peer || !input.transport.inboundRoutes?.length)
            throw new Error("OpenMLS identity and transport scope mismatch.");
        const bridge = await (input.sessionFactory ?? createStarknetOpenMlsSession)(input.identity);
        const cid = await directMlsConversationId(input.identity.chainId, input.identity.roomId, own, peer);
        return new StarknetOpenMlsChat(bridge, input.identity, input.transport, peer, cid);
    }
    static async walletVerifier(data: Parameters<MlsWalletVerifier>[0], sig: readonly string[], wallet: string): Promise<boolean> {
        try {
            return await verifyMessageInStarknet(getProvider(), data, [...sig], wallet);
        }
        catch {
            return false;
        }
    }
    private exclusive<T>(run: () => Promise<T>): Promise<T> { const next = this.queue.catch(() => undefined).then(run); this.queue = next; return next; }
    private persist = () => this.bridge.saveApplicationState(encode(this.state));
    private async packets() { return (await readStarknetMlsOnchain(this.transport)).complete; }
    private async peerPackage(): Promise<SignedMlsKeyPackage | null> {
        const packets = (await this.packets()).filter(packet => packet.kind === "key_package" && canonicalStarknetAddress(packet.sender) === this.peerAddress);
        for (const packet of packets.reverse())
            try {
                const value = decode<SignedMlsKeyPackage>(packet.bytes);
                await verifySignedMlsKeyPackage(value, { chainId: this.ownScope.chainId, roomId: this.ownScope.roomId, expectedWalletAddress: this.peerAddress }, StarknetOpenMlsChat.walletVerifier);
                return value;
            }
            catch { /* Another installation or an expired/forged package is not an identity. */ }
        return null;
    }
    private async publish(kind: MlsPacketPlan["kind"], bytes: Uint8Array, confirm: (count: number, kind: string) => Promise<boolean>): Promise<ConfirmedMlsPacket> {
        const pending = this.state.pendingTransport;
        if (pending && (pending.kind !== kind || !sameBytes(Uint8Array.from(pending.bytes), bytes)))
            throw new Error("MLS has an unfinished packet. Resume it before creating another operation.");
        if (!pending) {
            this.state.pendingTransport = await prepareStarknetMlsPacket(this.transport, kind, bytes);
            await this.persist();
        }
        return sendStarknetMlsOnchain(this.transport, this.state.pendingTransport!, this.persist, confirm);
    }
    get canInvite(): boolean { return BigInt(this.ownScope.walletAddress) < BigInt(this.peerAddress); }
    async isReady(): Promise<boolean> { try {
        return (await this.bridge.getGroupSnapshot(this.conversationId)).epoch > 0n;
    }
    catch {
        return false;
    } }
    async status() { this.bridge.readApplicationState(); return { ready: await this.isReady(), keyPublished: !!this.state.keyPackagePublished, pendingBody: this.state.pendingApplication?.message.body, pending: this.state.pendingTransport?.kind, inbox: [...this.state.inbox] }; }
    async hasVerifiedPeerKeyPackage() { return (await this.peerPackage()) !== null; }
    async publishKeyPackage(confirm: (count: number, kind: string) => Promise<boolean>): Promise<void> {
        return this.exclusive(async () => {
            if (this.state.keyPackagePublished && (this.state.keyPackageExpiresAt ?? 0) > Date.now() + 300000 && !this.state.pendingTransport)
                return;
            let bytes: Uint8Array;
            if (this.state.pendingTransport?.kind === "key_package")
                bytes = Uint8Array.from(this.state.pendingTransport.bytes);
            else {
                const now = Date.now();
                const attested = await createSignedMlsKeyPackage({ ...this.ownScope, keyPackage: await this.bridge.createKeyPackage(), issuedAt: now, expiresAt: now + 60 * 60 * 1000 }, async (data) => signature(await this.transport.account.signMessage(data) as Signature));
                await verifySignedMlsKeyPackage(attested, { chainId: this.ownScope.chainId, roomId: this.ownScope.roomId, expectedWalletAddress: this.ownScope.walletAddress }, StarknetOpenMlsChat.walletVerifier);
                bytes = encode(attested);
            }
            await this.publish("key_package", bytes, confirm);
            this.state.keyPackagePublished = true;
            this.state.keyPackageExpiresAt = decode<SignedMlsKeyPackage>(bytes).expiresAt;
            delete this.state.pendingTransport;
            await this.persist();
        });
    }
    async invitePeer(confirm: (count: number, kind: string) => Promise<boolean>): Promise<void> {
        return this.exclusive(async () => {
            if (!this.canInvite)
                throw new Error("The designated peer creates this MLS session. Sync its signed Welcome instead.");
            if (await this.isReady()) {
                // A crash may occur after merging the published Welcome but before clearing
                // its durable transport plan. Reconcile that exact plan without a second merge.
                if (this.state.pendingTransport?.kind === "welcome") {
                    await this.publish("welcome", Uint8Array.from(this.state.pendingTransport.bytes), confirm);
                    await this.bridge.markGroupStatePublished(this.conversationId);
                    delete this.state.pendingTransport;
                    await this.persist();
                }
                return;
            }
            if (!this.state.keyPackagePublished)
                throw new Error("Publish your signed MLS KeyPackage first.");
            const peer = await this.peerPackage();
            if (!peer)
                throw new Error("Peer has no wallet-verified MLS KeyPackage.");
            let bytes: Uint8Array;
            if (this.state.pendingTransport?.kind === "welcome")
                bytes = Uint8Array.from(this.state.pendingTransport.bytes);
            else {
                const existing = (await this.bridge.listPendingOutboundCommits()).find(item => item.conversationId === this.conversationId);
                let welcome = existing?.welcome;
                if (!welcome) {
                    try {
                        await this.bridge.getGroupSnapshot(this.conversationId);
                    }
                    catch {
                        await this.bridge.createGroup({ conversationId: this.conversationId, title: "VINSS private chat", creator: member(this.ownScope, "admin") });
                    }
                    const peerScope = { chainId: peer.chainId, roomId: peer.roomId, walletAddress: peer.walletAddress, installationId: peer.installationId };
                    ({ welcome } = await this.bridge.prepareAddMember({ conversationId: this.conversationId, member: member(peerScope, "member"), keyPackage: await verifySignedMlsKeyPackage(peer, { chainId: this.ownScope.chainId, roomId: this.ownScope.roomId, expectedWalletAddress: this.peerAddress }, StarknetOpenMlsChat.walletVerifier) }));
                }
                const now = Date.now();
                const signed = await signMlsWelcome({ chainId: this.ownScope.chainId, roomId: this.ownScope.roomId, conversationId: this.conversationId, walletAddress: this.ownScope.walletAddress, recipientAddress: this.peerAddress, installationId: this.ownScope.installationId, recipientInstallationId: peer.installationId, issuedAt: now, expiresAt: now + 24 * 60 * 60 * 1000 }, welcome!, async (data) => signature(await this.transport.account.signMessage(data) as Signature));
                bytes = encode(signed);
                this.state.peerInstallationId = peer.installationId;
            }
            await this.publish("welcome", bytes, confirm);
            await this.bridge.mergePendingCommit(this.conversationId);
            await this.bridge.markGroupStatePublished(this.conversationId);
            delete this.state.pendingTransport;
            await this.persist();
        });
    }
    async joinFromPeerWelcome(): Promise<boolean> {
        return this.exclusive(async () => {
            if (await this.isReady())
                return true;
            if (this.canInvite)
                return false;
            const peer = await this.peerPackage();
            if (!peer)
                return false;
            const welcomes = (await this.packets()).filter(packet => packet.kind === "welcome" && canonicalStarknetAddress(packet.sender) === this.peerAddress).reverse();
            for (const packet of welcomes) {
                let value: SignedMlsWelcome, bytes: Uint8Array;
                try {
                    value = decode<SignedMlsWelcome>(packet.bytes);
                    bytes = await verifyMlsWelcome(value, { chainId: this.ownScope.chainId, roomId: this.ownScope.roomId, conversationId: this.conversationId, senderAddress: this.peerAddress, recipientAddress: this.ownScope.walletAddress, recipientInstallationId: this.ownScope.installationId }, StarknetOpenMlsChat.walletVerifier);
                    if (value.installationId !== peer.installationId)
                        continue;
                }
                catch {
                    continue;
                }
                const joined = await this.bridge.joinFromWelcome({ conversationId: this.conversationId, welcome: bytes, handshakeId: packet.packetId });
                const creatorScope = { chainId: value.chainId, roomId: value.roomId, walletAddress: value.walletAddress, installationId: value.installationId };
                await this.bridge.applyGroupSnapshot({ metadata: { conversationId: this.conversationId, title: "VINSS private chat", createdAt: value.issuedAt, createdBy: this.peerAddress }, epoch: joined.epoch, members: [member(creatorScope, "admin"), member(this.ownScope, "member")] });
                this.state.peerInstallationId = value.installationId;
                await this.persist();
                return true;
            }
            return false;
        });
    }
    async sendText(body: string, confirm: (count: number, kind: string) => Promise<boolean>): Promise<MlsInboxMessage> {
        return this.exclusive(async () => {
            if (!await this.isReady())
                throw new Error("MLS secure session is not ready.");
            if (!body.trim() || body.length > 3000)
                throw new Error("MLS message length is invalid.");
            let pending = this.state.pendingApplication;
            if (pending && pending.message.body !== body.trim())
                throw new Error("MLS has a pending message. Resume that message before writing another.");
            if (!pending) {
                const message: MlsPlaintextMessage = { version: 1, type: "message", from: canonicalStarknetAddress(this.ownScope.walletAddress), to: this.peerAddress, sentAt: Date.now(), body: body.trim() };
                await this.bridge.encryptApplicationMessage({ conversationId: this.conversationId, plaintext: encode(message), commitApplicationState: ciphertext => {
                        this.state.pendingApplication = { message, ciphertext: Array.from(ciphertext) };
                        return encode(this.state);
                    } });
                pending = this.state.pendingApplication!;
            }
            const packet = await this.publish("application", Uint8Array.from(pending.ciphertext), confirm);
            const result: MlsInboxMessage = { packetId: packet.packetId, sender: pending.message.from, message: pending.message, receipts: packet.receipts };
            if (!this.state.inbox.some(item => item.packetId === result.packetId))
                this.state.inbox.push(result);
            delete this.state.pendingApplication;
            delete this.state.pendingTransport;
            await this.persist();
            return result;
        });
    }
    async receiveTexts(): Promise<MlsInboxMessage[]> {
        return this.exclusive(async () => {
            if (!await this.isReady())
                return [];
            const packets = await this.packets();
            for (const packet of packets) {
                if (packet.kind !== "application" || canonicalStarknetAddress(packet.sender) !== this.peerAddress || this.state.inbox.some(item => item.packetId === packet.packetId))
                    continue;
                try {
                    await this.bridge.decryptApplicationMessage({ conversationId: this.conversationId, ciphertext: packet.bytes, commitApplicationState: bytes => {
                            try {
                                const message = decode<MlsPlaintextMessage>(bytes);
                                if (message.version === 1 && message.type === "message" && canonicalStarknetAddress(message.from) === this.peerAddress && canonicalStarknetAddress(message.to) === canonicalStarknetAddress(this.ownScope.walletAddress) && typeof message.body === "string" && message.body.trim() && Number.isSafeInteger(message.sentAt))
                                    this.state.inbox.push({ packetId: packet.packetId, sender: packet.sender, message, receipts: packet.receipts });
                            }
                            catch { /* Consume authenticated malformed application data without rendering it. */ }
                            return encode(this.state);
                        } });
                }
                catch {
                    // Crypto rejection rolls back; persistence failure faults the bridge and must stop this scan.
                    this.bridge.readApplicationState();
                }
            }
            return [...this.state.inbox];
        });
    }
}
