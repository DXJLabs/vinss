import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Starknet OpenMLS actual client flows through account-authorized native transport",()=>{
 const service=src("frontend/lib/openmls-core/starknet-mls-chat.ts");
 assert.match(service,/createStarknetOpenMlsSession/);
 assert.match(service,/createSignedMlsKeyPackage/);
 assert.match(service,/verifySignedMlsKeyPackage/);
 assert.match(service,/verifyMessageInStarknet/);
 assert.match(service,/sendStarknetMlsOnchain/);
 assert.match(service,/readStarknetMlsOnchain/);
 assert.match(service,/encryptApplicationMessage/);
 assert.match(service,/decryptApplicationMessage/);
 assert.match(service,/joinFromWelcome/);
 assert.match(service,/mergePendingCommit/);
 assert.match(service,/prepareAddMember/);
 assert.doesNotMatch(service,/WALLET_PROOF_BYPASS|verify:\s*async\s*\(\)\s*=>\s*true/);
});
test("Direct room offers explicit MLS onboarding without silently dropping legacy chat",()=>{
 const hook=src("frontend/hooks/room/useDirectConversation.ts");
 const page=src("frontend/components/room/conversation/DirectConversationPanel.tsx");
 const coord=src("frontend/hooks/room/useRoomConversation.ts");
 assert.match(hook,/useStarknetDirectMls/);
 assert.match(coord,/mlsDirect/);
 assert.match(page,/OpenMLS/);
 assert.match(page,/MLS_READY/);
 assert.match(hook,/kind\s*!==?\s*["']system_note["']/);
 assert.doesNotMatch(hook,/localStorage\.setItem\([^;]*?JSON\.stringify\(payload\)/s);
});
test("Group legacy messages and MLS control frames cannot be rendered as decrypted chat bubbles",()=>{
 const group=src("frontend/hooks/room/useGroupConversation.ts");
 assert.match(group,/item\.message\.kind\s*!==?\s*["']system_note["']/);
});

test("after MLS activation a wallet reload cannot silently downgrade new text to legacy crypto",()=>{
 const hook=src("frontend/hooks/room/useStarknetDirectMls.ts");
 const direct=src("frontend/hooks/room/useDirectConversation.ts");
 assert.match(hook,/vinss:mls-required:v1:/);
 assert.match(hook,/requiresMls/);
 assert.match(hook,/localStorage\.setItem\(/);
 assert.match(hook,/await chat\.isReady\(cid\)/);
 assert.match(direct,/mlsDirect\.requiresMls\(\)/);
 assert.match(direct,/OpenMLS.*not ready|secure session.*not ready|Sync MLS/i);
});
