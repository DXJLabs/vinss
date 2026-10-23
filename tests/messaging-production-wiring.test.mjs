import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
test("shared encryption uses length-preserving codec with authenticated legacy recovery",()=>{
 const source=readFileSync(new URL("../frontend/lib/privacy/envelope.ts",import.meta.url),"utf8");
 assert.match(source,/packEncryptedBytes\(withIv, MAX_PAYLOAD_CHUNKS\)/);
 assert.match(source,/recoverEncryptedByteCandidates\(chunks\)/);
 assert.match(source,/crypto\.subtle\.decrypt/);
 assert.doesNotMatch(source,/return packBytesIntoFelts\(withIv\)/);
});
test("active multichain gateway selects only registered Starknet native messaging",()=>{
 const source=readFileSync(new URL("../frontend/lib/deal-room/messageGateway.ts",import.meta.url),"utf8");
 assert.match(source,/makeMessageTransportId\("starknet", NETWORK, "strk20"\)/);
 assert.match(source,/nativeSend\(\.\.\.args\)/);
 assert.match(source,/NEXT_PUBLIC_MESSAGE_TRANSPORT_ID/);
 assert.doesNotMatch(source,/id:\s*["']canton:/);
});
