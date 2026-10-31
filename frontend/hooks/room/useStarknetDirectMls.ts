"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { constants, walletV6, type WalletAccountV6 } from "starknet";
import { getProvider, type VinssWalletSession } from "@/lib/starknet/walletClient";
import { NETWORK } from "@/lib/starknet/constants";
import { backendForAccount } from "@/lib/starknet/railConfig";
import { transactionModeOf } from "@/lib/starknet/transactionMode";
import { canonicalStarknetAddress, deriveDirectMessageKey, type MessagingIdentity } from "@/lib/privacy/participantKeys";
import { StarknetOpenMlsChat, type MlsInboxMessage } from "@/lib/openmls-core/starknet-mls-chat";
export type MlsDirectStatus = "inactive" | "initializing" | "key-published" | "peer-ready" | "waiting-welcome" | "MLS_READY" | "error";
export interface MlsDirectControls {
    status: MlsDirectStatus;
    busy: boolean;
    ready: boolean;
    error: string | null;
    pending: string | null;
    canInvite: boolean;
    requiresMls(): boolean;
    activate(): Promise<void>;
    sync(): Promise<void>;
    invite(): Promise<void>;
    resume(): Promise<void>;
    send(body: string): Promise<MlsInboxMessage>;
}
interface Input {
    roomId: string | null;
    account: WalletAccountV6 | null;
    wallet: VinssWalletSession["wallet"] | null;
    identity: MessagingIdentity | null;
    peerAddress: string | null;
    peerPublicKey: string | null;
    selfAliases: string[];
    onInbox(messages: MlsInboxMessage[]): void;
}
function lockKey(room: string | null, wallet: string | undefined, peer: string | null): string | null {
    return room && wallet && peer ? `vinss:mls-required:v2:${NETWORK}:${room}:${canonicalStarknetAddress(wallet)}:${canonicalStarknetAddress(peer)}` : null;
}
function safeError(error: unknown): string {
    return error instanceof Error && /^(OpenMLS|MLS|Peer|The designated|Publish your|Wallet)/.test(error.message) ? error.message : "OpenMLS operation could not be verified. Sync the secure session before retrying.";
}
export function useStarknetDirectMls({ roomId, account, wallet, identity, peerAddress, peerPublicKey, selfAliases, onInbox }: Input): MlsDirectControls {
    const [status, setStatus] = useState<MlsDirectStatus>("inactive"), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [pending, setPending] = useState<string | null>(null);
    const controller = useRef<StarknetOpenMlsChat | null>(null), initializing = useRef<Promise<StarknetOpenMlsChat> | null>(null), generation = useRef(0), running = useRef(false), inbox = useRef(onInbox);
    inbox.current = onInbox;
    const key = [NETWORK, roomId, account?.address, peerAddress, peerPublicKey, identity?.publicKey, transactionModeOf(account)].join("|");
    // New direct text always requires MLS. Legacy ciphertext remains readable;
    // losing a local preference flag must never enable a silent downgrade.
    const requiresMls = (): boolean => Boolean(lockKey(roomId, account?.address, peerAddress));
    useEffect(() => { generation.current++; controller.current = null; initializing.current = null; running.current = false; setBusy(false); setStatus("inactive"); setError(null); setPending(null); }, [key]);
    const init = useCallback(async (): Promise<StarknetOpenMlsChat> => {
        if (controller.current)
            return controller.current;
        if (initializing.current)
            return initializing.current;
        if (!roomId || !account || !wallet || !identity || !peerAddress || !peerPublicKey)
            throw new Error("MLS Direct needs a connected wallet and verified peer.");
        const token = generation.current;
        const request = (async () => {
            const [chain, rpc] = await Promise.all([walletV6.requestChainId(wallet), getProvider().getChainId()]);
            const expected = NETWORK === "mainnet" ? constants.StarknetChainId.SN_MAIN : constants.StarknetChainId.SN_SEPOLIA;
            if (BigInt(chain) !== BigInt(rpc) || BigInt(chain) !== BigInt(expected))
                throw new Error("MLS wallet, RPC and configured Starknet network must match.");
            const own = canonicalStarknetAddress(account.address), peer = canonicalStarknetAddress(peerAddress);
            const deviceKey = `vinss:mls-install:v2:${chain}:${roomId}:${own}:${peer}`;
            let installationId = window.localStorage.getItem(deviceKey);
            if (!installationId || !/^[0-9a-f]{32}$/.test(installationId)) {
                installationId = crypto.randomUUID().replace(/-/g, "");
                window.localStorage.setItem(deviceKey, installationId);
            }
            const initializedKey = deviceKey + ":initialized";
            const directKey = await deriveDirectMessageKey(roomId, identity.privateKey, peerPublicKey);
            const aliases = [...new Set([own, account.address, ...selfAliases, peer, peerAddress])];
            const chat = await StarknetOpenMlsChat.initialize({ identity: { chainId: chain, roomId, walletAddress: own, installationId, requireExisting: window.localStorage.getItem(initializedKey) === "1" }, peerAddress: peer,
                transport: { account, network: chain, roomId, scope: "direct", encryptionKey: directKey, messagingPublicKey: identity.publicKey, outboundRoute: { recipientIdentity: peerAddress, encryptionKey: directKey, routingKey: directKey }, inboundRoutes: aliases.map(recipientIdentity => ({ recipientIdentity, encryptionKey: directKey, routingKey: directKey })), backendUrl: backendForAccount(account) } });
            window.localStorage.setItem(initializedKey, "1");
            if (token !== generation.current)
                throw new Error("MLS peer or wallet changed during initialization.");
            controller.current = chat;
            return chat;
        })();
        initializing.current = request;
        try {
            return await request;
        }
        finally {
            if (initializing.current === request)
                initializing.current = null;
        }
    }, [key, wallet, selfAliases.join("|")]);
    const refresh = useCallback(async (chat: StarknetOpenMlsChat, token: number) => {
        const state = await chat.status();
        const messages = state.ready ? await chat.receiveTexts() : [];
        const peerReady = !state.ready && await chat.hasVerifiedPeerKeyPackage();
        if (token !== generation.current)
            return;
        setPending(state.pending ?? null);
        if (state.ready) {
            setStatus("MLS_READY");
            inbox.current(messages);
        }
        else
            setStatus(peerReady && state.keyPublished ? "peer-ready" : state.keyPublished ? "waiting-welcome" : "inactive");
    }, []);
    const run = useCallback(async (operation: (chat: StarknetOpenMlsChat) => Promise<void>) => {
        if (running.current)
            return;
        const token = generation.current;
        running.current = true;
        setBusy(true);
        setError(null);
        try {
            const chat = await init();
            await operation(chat);
            if (token === generation.current)
                await refresh(chat, token);
        }
        catch (cause) {
            if (token === generation.current) {
                const state = await controller.current?.status().catch(() => undefined);
                setPending(state?.pending ?? null);
                controller.current = null;
                setStatus("error");
                setError(safeError(cause));
            }
        }
        finally {
            if (token === generation.current) {
                running.current = false;
                setBusy(false);
            }
        }
    }, [init, refresh]);
    const confirmMultiple = useCallback(async (count: number, kind: string) => window.confirm(`OpenMLS ${kind} needs ${count} separate on-chain transactions. Each has a VINSS action fee and may have pool/network fees. Continue?`), []);
    const activate = useCallback(async () => {
        const scope = lockKey(roomId, account?.address, peerAddress);
        if (!scope)
            return;
        try {
            window.localStorage.setItem(scope, "1");
        }
        catch {
            setError("OpenMLS activation requires persistent device storage.");
            setStatus("error");
            return;
        }
        setStatus("initializing");
        await run(chat => chat.publishKeyPackage(confirmMultiple));
    }, [run, confirmMultiple, key]);
    const sync = useCallback(async () => {
        if (!requiresMls())
            return;
        await run(async (chat) => { await chat.joinFromPeerWelcome(); });
    }, [run, key]);
    const invite = useCallback(async () => { await run(chat => chat.invitePeer(confirmMultiple)); }, [run, confirmMultiple]);
    const send = useCallback(async (body: string): Promise<MlsInboxMessage> => {
        if (running.current)
            throw new Error("MLS operation is already in progress.");
        const token = generation.current;
        running.current = true;
        setBusy(true);
        setError(null);
        try {
            const chat = await init();
            const message = await chat.sendText(body, confirmMultiple);
            if (token !== generation.current)
                throw new Error("MLS wallet or peer changed before confirmation.");
            inbox.current([message]);
            await refresh(chat, token);
            return message;
        }
        catch (cause) {
            if (token === generation.current) {
                const state = await controller.current?.status().catch(() => undefined);
                setPending(state?.pending ?? null);
                controller.current = null;
                setError(safeError(cause));
                setStatus("error");
            }
            throw new Error(safeError(cause));
        }
        finally {
            if (token === generation.current) {
                running.current = false;
                setBusy(false);
            }
        }
    }, [init, confirmMultiple, refresh]);
    const resume = useCallback(async () => {
        await run(chat => chat.resumePending(confirmMultiple));
    }, [run, confirmMultiple]);
    useEffect(() => {
        if (!requiresMls())
            return;
        let stopped = false;
        const poll = async () => { if (stopped || running.current)
            return; await sync(); };
        void poll();
        const timer = setInterval(() => void poll(), 7500);
        return () => { stopped = true; clearInterval(timer); };
    }, [key, sync]);
    let canInvite = false;
    try {
        canInvite = Boolean(account && peerAddress && BigInt(account.address) < BigInt(peerAddress));
    }
    catch { /* Invalid participants cannot initialize MLS. */ }
    return { status, busy, ready: status === "MLS_READY", error, pending, canInvite, requiresMls, activate, sync, invite, resume, send };
}
