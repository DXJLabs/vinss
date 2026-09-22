import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { readFileSync } from "node:fs";
import type { WalletAccountV6, STRK20_ACTION } from "starknet";
import { packCiphertext, unpackCiphertext, PACKING_V2 } from "../lib/privacy/ciphertextPacking";
import { encryptPayload, decryptPayload } from "../lib/privacy/envelope";
import { deriveDirectMessageKey } from "../lib/privacy/participantKeys";
import { NETWORKS, assertChainId, assertPoolNetwork, parseNetwork } from "../lib/starknet/network";
import { CONTRACTS, STRK_ADDRESS } from "../lib/starknet/constants";
import { assertHelperCompatibility } from "../lib/starknet/contractCompatibility";
import { invokeShieldedTransaction, assertCertificateReady } from "../lib/starknet/guards";
import { shieldStrk } from "../lib/starknet/nativeShield";
import { getProvider } from "../lib/starknet/walletClient";
import { backendFetch } from "../lib/starknet/backendFetch";
import { networkStorage, STORAGE_PREFIX } from "../lib/starknet/networkStorage";
import { buildEscrowOfferSnapshot, parseSettlementAmount } from "../lib/deal-room/escrowSettlement";
import type { OfferActionPayload } from "../types/deal-room";
import { sendMessage, discoverMessages } from "../lib/deal-room/messaging";
import { sendOfferAction, discoverOfferActions } from "../lib/deal-room/offers";
import { sendEscrowCoordinationAction, discoverEscrowActions } from "../lib/deal-room/escrow";
import { depositEscrow, releaseEscrow } from "../lib/deal-room/settlement";
import { sameFelt } from "../lib/starknet/network";

afterEach(() => mock.restoreAll());
const deployed = JSON.parse(readFileSync("tests/fixtures/sepolia-legacy-helper-abis.json", "utf8"));
const current = JSON.parse(readFileSync("tests/fixtures/sepolia-current-helper-abis.json", "utf8"));
const sepolia = NETWORKS.sepolia.chainId;

test("ciphertext preserves zero bytes at every chunk boundary and the final byte", () => {
  for (const size of [1, 29, 30, 31, 59, 60, 61, 512, 1860]) {
    const bytes = new Uint8Array(size).fill(173);
    for (let index = 0; index < size; index += 30) bytes[index] = 0;
    bytes[size - 1] = 0;
    assert.deepEqual(unpackCiphertext(packCiphertext(bytes)), bytes);
    assert.ok(packCiphertext(bytes).every((felt) => felt < 2n ** 251n));
  }
});

test("malformed/truncated ciphertext is rejected; intact legacy bytes remain readable", () => {
  assert.throws(() => unpackCiphertext([PACKING_V2, 31n, 1n]), /Truncated/);
  assert.throws(() => unpackCiphertext([PACKING_V2, 1n, 256n]), /Invalid/);
  assert.throws(() => unpackCiphertext([PACKING_V2, -1n]), /Invalid/);
  assert.throws(() => unpackCiphertext([-1n]), /Invalid/);
  assert.throws(() => packCiphertext(new Uint8Array(1861)), /exceeds/);
  assert.deepEqual(unpackCiphertext([0x123400n, 0xabcden]), new Uint8Array([0x12, 0x34, 0, 0xa, 0xbc, 0xde]));
});

test("Alice/Bob application encryption carries Chat, accepted Offer and Escrow snapshot; Eve and tampering fail", async () => {
  const makeKey = () => crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as Promise<CryptoKeyPair>;
  const [alice, bob, eve] = await Promise.all([makeKey(), makeKey(), makeKey()]);
  const pub = async (key: CryptoKey) => "0x" + Buffer.from(await crypto.subtle.exportKey("raw", key)).toString("hex");
  const aliceKey = await deriveDirectMessageKey("sepolia-room", alice.privateKey, await pub(bob.publicKey));
  const bobKey = await deriveDirectMessageKey("sepolia-room", bob.privateKey, await pub(alice.publicKey));
  const eveKey = await deriveDirectMessageKey("sepolia-room", eve.privateKey, await pub(alice.publicKey));
  assert.deepEqual(aliceKey, bobKey);
  const offer: OfferActionPayload = { kind: "accept", senderAddress: "0xa", recipientAddress: "0xb", sentAt: "2026-09-21T00:00:00Z", asset: "STRK", amount: "1.000000000000000001", paymentTerms: "Release after delivery", rootOfferLocator: "0x1", parentOfferLocator: "0x2" };
  const snapshot = buildEscrowOfferSnapshot("0x3", offer);
  for (const payload of [{ body: "Alice → Bob \u0000 👋" }, offer, { kind: "create", offerSnapshot: snapshot }]) {
    const ciphertext = await encryptPayload(aliceKey, payload);
    assert.deepEqual(await decryptPayload(bobKey, ciphertext), JSON.parse(JSON.stringify(payload)));
    await assert.rejects(decryptPayload(eveKey, ciphertext));
    const corrupted = [...ciphertext]; corrupted[2] = corrupted[2]! ^ 1n;
    await assert.rejects(decryptPayload(bobKey, corrupted));
  }
  assert.equal(parseSettlementAmount(offer.amount, 18), 1000000000000000001n);
});

test("new ciphertext authenticates the network and pool", async () => {
  const keyBytes = new Uint8Array(32).fill(42);
  const cipher = await encryptPayload(keyBytes, { body: "private" });
  const bytes = unpackCiphertext(cipher);
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  await assert.rejects(crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12),
    additionalData: new TextEncoder().encode(`VINSS_PAYLOAD_V2:mainnet:${BigInt(NETWORKS.mainnet.privacyPool).toString(16)}`) }, key, bytes.slice(12)));
});

test("invalid network and crossed pool/RPC are rejected with padded felt support", () => {
  assert.throws(() => parseNetwork("mainent"));
  assertChainId("sepolia", "0x0" + sepolia.slice(2), "wallet");
  assert.throws(() => assertChainId("sepolia", NETWORKS.mainnet.chainId, "RPC"));
  assert.throws(() => assertPoolNetwork("sepolia", NETWORKS.mainnet.privacyPool));
  assert.throws(() => assertPoolNetwork("mainnet", NETWORKS.sepolia.privacyPool));
});

test("legacy Sepolia ABIs cannot be mistaken for current fee/settlement contracts", () => {
  for (const name of ["VinssMessageHelper", "VinssOfferHelper", "VinssInvite"]) {
    assert.throws(() => assertHelperCompatibility(deployed[name].abi, ["get_fee_policy"], name), /incompatible/);
  }
  assert.throws(() => assertHelperCompatibility(deployed.VinssEscrowRekber.abi,
    ["quote_rekber_fee", "get_revenue_fee_policy"], "Rekber"), /incompatible/);
  assertHelperCompatibility(deployed.VinssPrivateEscrowHelper.abi, ["privacy_invoke", "get_privacy_pool"], "PrivateEscrow");
});

function testAccount(chains: string[] = [sepolia], address = "0xa", ownAddress = "0xa") {
  let reads = 0;
  const submitted: STRK20_ACTION[][] = [];
  const account = { address: ownAddress, walletProvider: { features: { "starknet:walletApi": {
    request: async ({ type }: { type: string }) => type === "wallet_requestChainId"
      ? chains[Math.min(reads++, chains.length - 1)] : [address],
  } } }, strk20InvokeTransaction: async (actions: STRK20_ACTION[]) => {
    submitted.push(actions); return { transaction_hash: "0x123" };
  } } as unknown as WalletAccountV6;
  mock.method(globalThis, "fetch", async () => Response.json({ result: sepolia }));
  return { account, submitted };
}

test("native Shield passes only a deposit action to the wallet; no app-generated viewing key", async () => {
  const { account, submitted } = testAccount();
  await shieldStrk(account, 1000n);
  assert.deepEqual(submitted, [[{ type: "deposit", token: STRK_ADDRESS, amount: "0x3e8" }]]);
  await assert.rejects(shieldStrk(account, 0n));
  await assert.rejects(shieldStrk(account, 1n << 128n));
  assert.equal(submitted.length, 1);
});

test("wallet switching networks during preparation prevents any submission", async () => {
  const { account, submitted } = testAccount([sepolia, NETWORKS.mainnet.chainId]);
  await assert.rejects(shieldStrk(account, 1000n), /not on Starknet sepolia/);
  assert.equal(submitted.length, 0);
});

test("changing the selected wallet account prevents submission", async () => {
  const { account, submitted } = testAccount([sepolia], "0xb");
  await assert.rejects(shieldStrk(account, 1000n), /account changed/);
  assert.equal(submitted.length, 0);
});

test("legacy Sepolia helper stops before the wallet is asked to transact", async () => {
  const { account, submitted } = testAccount();
  const provider = getProvider();
  mock.method(provider, "getClassHashAt", async () => "0x100");
  mock.method(provider, "getClassAt", async () => ({ abi: deployed.VinssMessageHelper.abi }));
  await assert.rejects(invokeShieldedTransaction(account, [{ type: "invoke", contract: CONTRACTS.messageHelper, calldata: [] }]), /missing get_fee_policy/);
  assert.equal(submitted.length, 0);
});

test("backend with the wrong network or without a network binding is rejected", async () => {
  mock.method(globalThis, "fetch", async () => Response.json([], { headers: {
    "X-VINSS-Network": "mainnet", "X-VINSS-Privacy-Pool": NETWORKS.mainnet.privacyPool,
  } }));
  await assert.rejects(backendFetch("https://backend.invalid/discover"), /does not match/);
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => Response.json([]));
  await assert.rejects(backendFetch("https://backend.invalid/discover"), /does not match/);
});

test("Sepolia cache cannot read or delete mainnet recovery data", () => {
  const data: Record<string, string> = { "vinss:local-rooms": "mainnet rooms" };
  const storage = { getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => { data[key] = value; },
    removeItem: (key: string) => { delete data[key]; } };
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { value: { localStorage: storage }, configurable: true });
  try {
    assert.equal(networkStorage.getItem("vinss:local-rooms"), null);
    networkStorage.setItem("vinss:local-rooms", "sepolia rooms");
    assert.equal(data[STORAGE_PREFIX + "vinss:local-rooms"], "sepolia rooms");
    networkStorage.removeItem("vinss:local-rooms");
    assert.equal(data["vinss:local-rooms"], "mainnet rooms");
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

function currentRpc() {
  const records = Object.values(current) as Array<{ address: string; abi: unknown }>;
  const find = (address: string) => {
    const index = records.findIndex((record) => sameFelt(record.address, address));
    assert.notEqual(index, -1, "RPC double received an unconfigured address");
    return index;
  };
  const provider = getProvider();
  mock.method(provider, "getClassHashAt", async (address: string) => `0x${(0x200 + find(address)).toString(16)}`);
  mock.method(provider, "getClassAt", async (address: string) => ({ abi: records[find(address)]!.abi }));
  return provider;
}

test("certificate bound to a different Rekber is rejected before signing", async () => {
  const provider = currentRpc();
  mock.method(provider, "callContract", async () => ["0xbad"]);
  await assert.rejects(assertCertificateReady(), /different Rekber/);
});

test("Chat → Offer → Private Escrow discovery and funding/release bundles with wallet/RPC doubles", async () => {
  const alice = testAccount();
  const bob = testAccount([sepolia], "0xb", "0xb");
  const provider = currentRpc();
  const amount = parseSettlementAmount("1.000000000000000001", 18);
  const fee = 4n * 10n ** 18n;
  const custody = new Array<string>(39).fill("0x0");
  custody[0] = "0xabc"; custody[12] = STRK_ADDRESS; custody[13] = `0x${amount.toString(16)}`;
  mock.method(provider, "callContract", async ({ entrypoint }: { entrypoint: string }) => {
    switch (entrypoint) {
      case "get_privacy_pool": return [CONTRACTS.privacyPool];
      case "get_fee_policy": case "get_revenue_fee_policy": return [current.VinssFeePolicy.address];
      case "quote_fee": case "quote_rekber_fee": return [`0x${fee.toString(16)}`];
      case "get_custody": return custody;
      default: throw new Error(`Unexpected RPC ${entrypoint}`);
    }
  });
  type Record = { actionLocator: string; payloadCommitment: string; senderTag: string;
    recipientTag: string; ciphertextChunks: string[]; transactionHash: string; blockNumber: number };
  const indexed: { [kind: string]: Record[] } = {};
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).endsWith("/discover")) return Response.json({ result: sepolia });
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(Object.keys(body), ["kind"], "Discovery must not transmit keys or plaintext");
    return Response.json(indexed[body.kind] ?? [], { headers: {
      "X-VINSS-Network": "sepolia", "X-VINSS-Privacy-Pool": CONTRACTS.privacyPool,
    } });
  });
  function indexBundle(kind: string, bundle: STRK20_ACTION[]) {
    const invoke = bundle.find((action) => action.type === "invoke");
    assert.ok(invoke?.type === "invoke");
    assert.equal(BigInt(invoke.calldata[0]!), BigInt(invoke.calldata.length - 1));
    const data = invoke.calldata.slice(1);
    const count = Number(BigInt(data[5]!));
    assert.ok(count <= 64);
    const record = { actionLocator: data[1]!, senderTag: data[2]!, recipientTag: data[3]!,
      payloadCommitment: data[4]!, ciphertextChunks: data.slice(6, 6 + count),
      transactionHash: "0x123", blockNumber: 1 };
    indexed[kind] = [...(indexed[kind] ?? []), record];
    return record;
  }
  const key = crypto.getRandomValues(new Uint8Array(32));
  const toBob = { recipientIdentity: "0xb", encryptionKey: key, routingKey: key };
  const toAlice = { ...toBob, recipientIdentity: "0xa" };
  const sentAt = "2026-09-22T00:00:00Z";
  const oldTreasury = process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS;
  process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS = "0x000c"; // Test-only recipient; never sent to a real wallet.
  try {
    await sendMessage(alice.account, key, { kind: "text", body: "Hello Bob 👋", sentAt,
      senderIdentity: { address: "0xa", messagingPublicKey: "test" } }, toBob);
    indexBundle("message", alice.submitted.at(-1)!);
    assert.equal((await discoverMessages("https://test.invalid", key, toBob))[0]?.message.body, "Hello Bob 👋");
    assert.deepEqual(await discoverMessages("https://test.invalid", key, toAlice), []);
    assert.equal(alice.submitted.at(-1)?.[1]?.type, "transfer");
    assert.deepEqual(alice.submitted.at(-1)?.[1], { type: "transfer", token: STRK_ADDRESS, amount: "OPEN", recipient: "0xc" });

    const terms: OfferActionPayload = { kind: "create", senderAddress: "0xa", recipientAddress: "0xb",
      sentAt, asset: "STRK", amount: "1.000000000000000001", paymentTerms: "Release after delivery" };
    await sendOfferAction(alice.account, key, terms, toBob);
    const offer = indexBundle("offer", alice.submitted.at(-1)!);
    const received = (await discoverOfferActions("https://test.invalid", key, toBob))[0]!.action;
    assert.deepEqual(received, terms);
    const accepted: OfferActionPayload = { ...received, kind: "accept", senderAddress: "0xb",
      recipientAddress: "0xa", rootOfferLocator: offer.actionLocator, parentOfferLocator: offer.actionLocator };
    await sendOfferAction(bob.account, key, accepted, toAlice);
    const acceptance = indexBundle("offer", bob.submitted.at(-1)!);
    const agreed = (await discoverOfferActions("https://test.invalid", key, toAlice))[0]!.action;
    const snapshot = buildEscrowOfferSnapshot(acceptance.actionLocator, agreed);
    await sendEscrowCoordinationAction(alice.account, key, { kind: "create", dealOfferLocator: offer.actionLocator,
      senderAddress: "0xa", recipientAddress: "0xb", sentAt, offerSnapshot: snapshot }, toBob);
    indexBundle("escrow", alice.submitted.at(-1)!);
    assert.deepEqual((await discoverEscrowActions("https://test.invalid", key, toBob))[0]?.action.offerSnapshot, JSON.parse(JSON.stringify(snapshot)));

    await depositEscrow(alice.account, { custodyCommitment: 0xabcn, releaseAuthorizationCommitment: 1n,
      payeeClaimCommitment: 2n, refundCommitment: 3n, payerConfirmationCommitment: 4n,
      payerDisputeCommitment: 5n, payeeDisputeCommitment: 6n, payeeRefundConsentCommitment: 7n,
      fulfillmentChainHead: 8n, revisionChainHead: 9n, payerCertificateCommitment: 10n,
      payeeCertificateCommitment: 11n, refundAfter: 1900000000, reviewWindow: 3600,
      verificationPolicy: 0, fulfillmentRounds: 1, revisionRounds: 1, token: STRK_ADDRESS, amount });
    assert.deepEqual(alice.submitted.at(-1)?.[0], { type: "withdraw", token: STRK_ADDRESS,
      amount: `0x${(amount + fee).toString(16)}`, recipient: CONTRACTS.escrowRekber });
    await releaseEscrow(bob.account, { custodyCommitment: 0xabcn, releaseAuthorizationSecret: 12n, payeeClaimSecret: 13n });
    assert.deepEqual(bob.submitted.at(-1)?.[0], { type: "transfer", token: STRK_ADDRESS, amount: "OPEN", recipient: "0xb" });
    // These assertions cover the real app's calldata assembly, not a proof or contract execution.
  } finally {
    if (oldTreasury === undefined) delete process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS;
    else process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS = oldTreasury;
  }
});
