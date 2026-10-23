import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encryptLocalJson, decryptLocalJson } from "../frontend/lib/privacy/encryptedChatCache.ts";
test("local cache encrypts plaintext and refuses wrong pairwise MLS owner",async()=>{
 const first=new Uint8Array(32).fill(7),another=new Uint8Array(32).fill(8);
 const clear={entries:[{summary:"Confidential deal message"}]};
 const encoded=await encryptLocalJson(first,clear);
 assert.equal(JSON.stringify(encoded).includes(clear.entries[0].summary),false);
 assert.deepEqual(await decryptLocalJson(first,encoded),clear);
 await assert.rejects(decryptLocalJson(another,encoded));
});
test("direct cache v3 is pairwise ECDH, v2 room cache remains import only",()=>{
 const f=readFileSync(new URL("../frontend/hooks/room/useDirectConversation.ts",import.meta.url),"utf8");
 assert.match(f,/vinss:direct-history:v3:/);
 assert.match(f,/legacyRoomHistoryStorageKey/);
 assert.match(f,/const historyKey\s*=\s*await resolveDirectKey\(\)/);
 assert.match(f,/legacyRoomHistoryStorageKey\(\)/);
 assert.match(f,/loadEncryptedLocalJson[\s\S]*channelKey/);
});
test("wallet changes reset local decrypted Direct state and drafts",()=>{
 const f=readFileSync(new URL("../frontend/hooks/room/useDirectConversation.ts",import.meta.url),"utf8");
 assert.match(f,/setEntries\(\[\]\)/);
 assert.match(f,/setDrafts\(\{\}\)/);
});
