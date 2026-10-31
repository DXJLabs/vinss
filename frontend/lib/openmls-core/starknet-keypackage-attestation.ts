/**
 * STRK20 transport is independent from MLS participant authorization.
 * Bind an OpenMLS KeyPackage to a Starknet account with a domain-separated
 * SNIP-12 signature, then verify through the actual account contract.
 *
 * A local HMAC routing tag and a claimed senderAddress are NOT a wallet proof.
 * Caller-supplied verifiers MUST use native Starknet account validation.
 */
import type { TypedData } from "starknet";
export interface MlsKeyPackageScope {
    chainId: string;
    roomId: string;
    walletAddress: string;
    installationId: string;
    keyPackage: Uint8Array;
    issuedAt: number;
    expiresAt: number;
}
export interface SignedMlsKeyPackage {
    version: 1;
    chainId: string;
    roomId: string;
    walletAddress: string;
    installationId: string;
    keyPackage: string;
    keyPackageHash: string;
    installationHash: string;
    issuedAt: number;
    expiresAt: number;
    signature: string[];
}
export type MlsWalletSigner = (typedData: TypedData) => Promise<readonly string[]>;
export type MlsWalletVerifier = (typedData: TypedData, signature: readonly string[], walletAddress: string) => Promise<boolean>;
const FELT_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const PACKAGE_LIMIT = 16 * 1024;
function address(value: string): string {
    if (!/^0x[0-9a-fA-F]+$/.test(value))
        throw new Error("Invalid MLS wallet address.");
    const n = BigInt(value);
    if (!n || n >= FELT_PRIME)
        throw new Error("Invalid MLS wallet felt.");
    return "0x" + n.toString(16);
}
function validScope(scope: Pick<MlsKeyPackageScope, "chainId" | "roomId" | "walletAddress" | "installationId">): void {
    if (!/^0x[0-9a-fA-F]{1,60}$/.test(scope.chainId) ||
        !/^[\w:-]{1,128}$/.test(scope.roomId) ||
        !/^[\w:-]{1,128}$/.test(scope.installationId)) {
        throw new Error("Invalid MLS chain, room or installation scope.");
    }
    address(scope.walletAddress);
}
function encode(bytes: Uint8Array): string {
    let raw = "";
    for (const byte of bytes)
        raw += String.fromCharCode(byte);
    return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decode(value: string): Uint8Array {
    if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 30000)
        throw new Error("Invalid encoded KeyPackage.");
    const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
}
function hashHex(bytes: Uint8Array): Promise<string> {
    const copy = Uint8Array.from(bytes);
    return crypto.subtle.digest("SHA-256", copy.buffer).then(buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, "0")).join(""));
}
async function textFelt(value: string): Promise<string> {
    const d = await hashHex(new TextEncoder().encode(value));
    return "0x" + (BigInt("0x" + d) % FELT_PRIME).toString(16);
}
async function payloadTypedData(payload: SignedMlsKeyPackage): Promise<TypedData> {
    validScope(payload);
    return {
        types: {
            StarkNetDomain: [
                { name: "name", type: "felt" },
                { name: "version", type: "felt" },
                { name: "chainId", type: "felt" },
            ],
            KeyPackage: [
                { name: "wallet", type: "felt" },
                { name: "room", type: "felt" },
                { name: "installation", type: "felt" },
                { name: "packageDigest", type: "felt" },
                { name: "issuedAt", type: "felt" },
                { name: "expiresAt", type: "felt" },
            ],
        },
        primaryType: "KeyPackage",
        domain: { name: "VINSS_MLS", version: "1", chainId: payload.chainId },
        message: {
            wallet: address(payload.walletAddress),
            room: await textFelt(payload.roomId),
            installation: await textFelt(payload.installationId),
            packageDigest: "0x" + (BigInt("0x" + payload.keyPackageHash) % FELT_PRIME).toString(16),
            issuedAt: String(payload.issuedAt),
            expiresAt: String(payload.expiresAt),
        },
    };
}
function checkTimes(issuedAt: number, expiresAt: number, now: number): void {
    if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) ||
        expiresAt <= issuedAt || expiresAt - issuedAt > MAX_AGE_MS ||
        issuedAt > now + CLOCK_SKEW_MS || expiresAt <= now) {
        throw new Error("MLS KeyPackage is expired or has invalid time bounds.");
    }
}
export async function createSignedMlsKeyPackage(input: MlsKeyPackageScope, signer: MlsWalletSigner): Promise<SignedMlsKeyPackage> {
    validScope(input);
    if (!(input.keyPackage instanceof Uint8Array) ||
        !input.keyPackage.length || input.keyPackage.length > PACKAGE_LIMIT) {
        throw new Error("Invalid MLS KeyPackage length.");
    }
    checkTimes(input.issuedAt, input.expiresAt, input.issuedAt);
    const out: SignedMlsKeyPackage = {
        version: 1,
        chainId: input.chainId,
        roomId: input.roomId,
        walletAddress: address(input.walletAddress),
        installationId: input.installationId,
        keyPackage: encode(input.keyPackage),
        keyPackageHash: await hashHex(input.keyPackage),
        installationHash: await textFelt(input.installationId),
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
        signature: [],
    };
    const signed = await signer(await payloadTypedData(out));
    if (!Array.isArray(signed) || signed.length < 2 || signed.length > 16 ||
        signed.some(x => typeof x !== "string" || !/^0x[0-9a-fA-F]+$/.test(x))) {
        throw new Error("Wallet returned invalid MLS identity signature.");
    }
    out.signature = [...signed];
    return out;
}
export async function verifySignedMlsKeyPackage(input: SignedMlsKeyPackage, scope: {
    chainId: string;
    roomId: string;
    expectedWalletAddress: string;
    now?: number;
}, verifier?: MlsWalletVerifier): Promise<Uint8Array> {
    if (typeof verifier !== "function")
        throw new Error("MLS wallet verifier is required.");
    if (!input || input.version !== 1)
        throw new Error("Unsupported MLS KeyPackage version.");
    validScope(input);
    if (input.chainId.toLowerCase() !== scope.chainId.toLowerCase())
        throw new Error("MLS chain mismatch.");
    if (input.roomId !== scope.roomId)
        throw new Error("MLS room mismatch.");
    if (address(input.walletAddress) !== address(scope.expectedWalletAddress))
        throw new Error("MLS wallet mismatch.");
    checkTimes(input.issuedAt, input.expiresAt, scope.now ?? Date.now());
    if (!Array.isArray(input.signature) || input.signature.length < 2 ||
        input.signature.some(x => typeof x !== "string" || !/^0x[0-9a-fA-F]+$/.test(x))) {
        throw new Error("Missing or invalid MLS wallet signature.");
    }
    const bytes = decode(input.keyPackage);
    if (!bytes.length || bytes.length > PACKAGE_LIMIT ||
        (await hashHex(bytes)) !== input.keyPackageHash) {
        throw new Error("MLS KeyPackage bytes are corrupted or modified.");
    }
    if (input.installationHash !== await textFelt(input.installationId)) {
        throw new Error("MLS installation identity was modified.");
    }
    const verified = await verifier(await payloadTypedData(input), input.signature, address(input.walletAddress));
    if (verified !== true)
        throw new Error("MLS wallet signature verification failed.");
    return bytes;
}
export interface SignedMlsWelcome {
    version: 1;
    kind: "welcome";
    chainId: string;
    roomId: string;
    conversationId: string;
    walletAddress: string;
    recipientAddress: string;
    installationId: string;
    recipientInstallationId: string;
    welcome: string;
    digest: string;
    issuedAt: number;
    expiresAt: number;
    signature: string[];
}
async function welcomeTypedData(value: SignedMlsWelcome): Promise<TypedData> {
    validScope(value);
    return { types: { StarknetDomain: [{ name: "name", type: "shortstring" }, { name: "version", type: "shortstring" }, { name: "chainId", type: "shortstring" }, { name: "revision", type: "shortstring" }],
            Welcome: [{ name: "Sender", type: "ContractAddress" }, { name: "Recipient", type: "ContractAddress" }, { name: "Room", type: "felt" }, { name: "Conversation", type: "felt" }, { name: "SenderDevice", type: "felt" }, { name: "RecipientDevice", type: "felt" }, { name: "Welcome", type: "felt" }, { name: "Issued", type: "u128" }, { name: "Expires", type: "u128" }] },
        primaryType: "Welcome", domain: { name: "VINSS MLS Welcome", version: "1", chainId: value.chainId, revision: "1" },
        message: { Sender: address(value.walletAddress), Recipient: address(value.recipientAddress), Room: await textFelt(value.roomId), Conversation: await textFelt(value.conversationId), SenderDevice: await textFelt(value.installationId), RecipientDevice: await textFelt(value.recipientInstallationId), Welcome: "0x" + (BigInt("0x" + value.digest) % FELT_PRIME).toString(16), Issued: String(value.issuedAt), Expires: String(value.expiresAt) } };
}
export async function signMlsWelcome(value: Omit<SignedMlsWelcome, "signature" | "welcome" | "digest" | "version" | "kind">, bytes: Uint8Array, signer: MlsWalletSigner): Promise<SignedMlsWelcome> {
    const result: SignedMlsWelcome = { ...value, version: 1, kind: "welcome", welcome: encode(bytes), digest: await hashHex(bytes), signature: [] };
    checkTimes(result.issuedAt, result.expiresAt, Date.now());
    result.signature = [...await signer(await welcomeTypedData(result))];
    return result;
}
export async function verifyMlsWelcome(value: SignedMlsWelcome, scope: {
    chainId: string;
    roomId: string;
    conversationId: string;
    senderAddress: string;
    recipientAddress: string;
    recipientInstallationId: string;
}, verifier: MlsWalletVerifier): Promise<Uint8Array> {
    if (value?.version !== 1 || value.kind !== "welcome" || value.chainId !== scope.chainId || value.roomId !== scope.roomId || value.conversationId !== scope.conversationId ||
        address(value.walletAddress) !== address(scope.senderAddress) || address(value.recipientAddress) !== address(scope.recipientAddress) || value.recipientInstallationId !== scope.recipientInstallationId)
        throw new Error("MLS Welcome scope or participant mismatch.");
    checkTimes(value.issuedAt, value.expiresAt, Date.now());
    if (!Array.isArray(value.signature) || value.signature.length < 2 || value.signature.length > 128)
        throw new Error("Missing MLS Welcome wallet signature.");
    const bytes = decode(value.welcome);
    if (!bytes.length || bytes.length > PACKAGE_LIMIT || await hashHex(bytes) !== value.digest || !await verifier(await welcomeTypedData(value), value.signature, value.walletAddress))
        throw new Error("MLS Welcome authentication failed.");
    return bytes;
}
