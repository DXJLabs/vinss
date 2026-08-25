import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const agentClient = await readFile(
  new URL("../frontend/lib/agent.ts", import.meta.url),
  "utf8",
);
const rooms = await readFile(
  new URL("../frontend/app/rooms/page.tsx", import.meta.url),
  "utf8",
);
const agent = await readFile(
  new URL(
    "../backend/src/agent/providers/groq.ts",
    import.meta.url,
  ),
  "utf8",
);

assert.equal(
  agentClient.includes("GROQ_API_KEY"),
  false,
  "Groq secret must never be referenced by frontend code",
);
assert.equal(
  rooms.includes("secret {room.roomSecret}"),
  false,
  "Room secret must not be rendered in the room list",
);

const agentPrompt = await readFile(
  new URL(
    "../backend/src/agent/prompts.ts",
    import.meta.url,
  ),
  "utf8",
);
const runtime = await readFile(
  new URL(
    "../backend/src/agent/runtime.ts",
    import.meta.url,
  ),
  "utf8",
);
const agentRoute = await readFile(
  new URL(
    "../backend/src/routes/agent.ts",
    import.meta.url,
  ),
  "utf8",
);

assert.equal(
  /never.*sign.*send/i.test(agentPrompt),
  true,
  "Agent system policy must prohibit transaction signing",
);
assert.equal(
  agentPrompt.includes("viewing keys"),
  true,
  "Agent system policy must prohibit viewing-key access",
);
assert.equal(
  runtime.includes("Tool not allowed for"),
  true,
  "Skill runtime must enforce tool scope",
);
assert.equal(
  agentClient.includes("privacySafeTimeline"),
  true,
  "Frontend must sanitize private timeline before Agent network request",
);
assert.equal(
  agentClient.includes(
    "roomLabel: input.context.roomLabel",
  ),
  false,
  "Room label must not be sent to remote Agent",
);
assert.equal(
  agentRoute.includes("config.network"),
  true,
  "Agent response must be network-aware",
);
console.log("privacy boundary checks: PASS");

const discoverRoute = await readFile(
  new URL(
    "../backend/src/routes/discover.ts",
    import.meta.url,
  ),
  "utf8",
);
const discoverTypes = await readFile(
  new URL("../backend/src/types.ts", import.meta.url),
  "utf8",
);
const discoverIndex = await readFile(
  new URL(
    "../backend/src/indexer/poolEvents.ts",
    import.meta.url,
  ),
  "utf8",
);
const discoveryStore = await readFile(
  new URL(
    "../backend/src/indexer/store.ts",
    import.meta.url,
  ),
  "utf8",
);
const config = await readFile(
  new URL("../backend/src/config.ts", import.meta.url),
  "utf8",
);
const messaging = await readFile(
  new URL(
    "../frontend/lib/deal-room/messaging.ts",
    import.meta.url,
  ),
  "utf8",
);
const offer = await readFile(
  new URL(
    "../frontend/lib/deal-room/offers.ts",
    import.meta.url,
  ),
  "utf8",
);

assert.equal(
  discoverRoute.includes("decryptMatching"),
  false,
  "backend discovery must not decrypt",
);
assert.equal(
  discoverTypes.includes("channelKeyHex"),
  false,
  "DiscoverRequest must not contain channelKeyHex",
);
assert.equal(
  /import .*decrypt|decryptMatching|tryDecrypt|subtle\.decrypt/.test(
    discoverIndex,
  ),
  false,
  "indexer must not contain decryption code",
);
assert.equal(
  discoverIndex.includes("continuation_token"),
  true,
  "event ingestion must paginate starknet_getEvents",
);
assert.equal(
  discoverIndex.includes("latest - 10_000"),
  false,
  "indexer must not use a latest-10000 heuristic",
);
assert.equal(
  discoveryStore.includes("room_id"),
  false,
  "persistent discovery index must not store roomId",
);
assert.equal(
  discoveryStore.includes("room_secret"),
  false,
  "persistent discovery index must not store roomSecret",
);
assert.equal(
  discoveryStore.includes("plaintext"),
  false,
  "persistent discovery index must not store plaintext",
);
assert.equal(
  config.includes(
    '"STARKNET_NETWORK"'
  ),
  true,
  "network must be explicit configuration",
);
assert.equal(
  config.includes(
    "free-rpc.nethermind.io"
  ),
  false,
  "backend must not silently fallback to a Sepolia RPC",
);
assert.equal(
  messaging.includes(
    "body: JSON.stringify({ channelKeyHex",
  ),
  false,
  "message discovery must not send channelKeyHex",
);
assert.equal(
  offer.includes(
    "body: JSON.stringify({ channelKeyHex",
  ),
  false,
  "offer discovery must not send channelKeyHex",
);
assert.match(
  messaging,
  /decryptPayload/,
  "message discovery must decrypt locally",
);
assert.match(
  offer,
  /decryptPayload/,
  "offer discovery must decrypt locally",
);
console.log(
  "ciphertext-only discovery boundary checks: PASS",
);

const settlementFrontend = await readFile(
  new URL(
    "../frontend/lib/deal-room/settlement.ts",
    import.meta.url,
  ),
  "utf8",
);
const roomEscrowHook = await readFile(
  new URL(
    "../frontend/hooks/room/useRoomEscrow.ts",
    import.meta.url,
  ),
  "utf8",
);
const escrowPanel = await readFile(
  new URL(
    "../frontend/components/room/escrow/EscrowPanel.tsx",
    import.meta.url,
  ),
  "utf8",
);
const escrowCommitments = await readFile(
  new URL(
    "../contracts/src/escrow_rekber/commitments.cairo",
    import.meta.url,
  ),
  "utf8",
);

for (const domain of [
  "VINSS_RELEASE_AUTH",
  "VINSS_PAYEE_CLAIM",
  "VINSS_ESCROW_REFUND",
]) {
  assert.equal(
    settlementFrontend.includes(domain),
    true,
    `frontend Rekber commitment must include ${domain}`,
  );
  assert.equal(
    escrowCommitments.includes(domain),
    true,
    `Cairo Rekber commitment must include ${domain}`,
  );
}

assert.match(
  escrowPanel,
  /parseSettlementAmount/,
  "accepted Offer decimal amount must be converted to token base units",
);

assert.equal(
  roomEscrowHook.includes("prepareEscrowFromOffer"),
  false,
  "Rekber setup must not create a paid OfferHelper prepare action",
);
assert.equal(
  roomEscrowHook.includes("startDirectRekber"),
  false,
  "Rekber setup must use only the private escrow coordination channel",
);
assert.equal(
  escrowPanel.includes("onStartRekber"),
  false,
  "Rekber setup UI must not invoke the removed paid preparation callback",
);
assert.match(
  escrowPanel,
  /coordinationLockRef/,
  "Rekber setup UI must synchronously block duplicate wallet requests",
);
assert.match(
  escrowPanel,
  /pendingPayerSetup/,
  "Rekber setup retry must reuse the pending payer authorization",
);

console.log(
  "escrow Rekber cross-layer boundary checks: PASS",
);
