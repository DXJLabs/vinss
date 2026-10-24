import test from "node:test";
import assert from "node:assert/strict";
import { buildPublicRailCalls, publicInvokePayload } from "../frontend/lib/starknet/publicRailCalls.ts";
import { accountForMode, transactionModeOf, parseTransactionMode } from "../frontend/lib/starknet/transactionMode.ts";
const c = { adapter: "0x100", treasury: "0x200", feeToken: "0x300", invite:"0x1", messageHelper:"0x2", offerHelper:"0x3", privateEscrowHelper:"0x4", escrowRekber:"0x5" };
const invoke = (contract,payload)=>({type:"invoke",contract,calldata:[String(payload.length),...payload]});
const fund = (recipient,amount="42")=>({type:"withdraw",token:c.feeToken,recipient,amount});
const meta = { locatorNonce:"0x44", inviteClaimKey:"0x55" };
const open = {type:"transfer",token:c.feeToken,recipient:c.treasury,amount:"OPEN"};
const payload=["1","7","8","9","10","1","11","42","${openNoteIds[0]}"];
test("ordinary account calls cover room, message, offer and encrypted escrow routes",()=>{
 for(const [target,entrypoint,data] of [[c.invite,"create_invite",["0","7","100","42","${openNoteIds[0]}"]],[c.messageHelper,"post_message",payload],[c.offerHelper,"post_offer",payload]]){
  const calls=buildPublicRailCalls([fund(target),open,invoke(target,data)],c,meta);
  assert.equal(calls[0].entrypoint,"approve");
  assert.equal(calls[1].contractAddress,c.adapter);
  assert.equal(calls[1].entrypoint,entrypoint);
  assert.equal(calls[1].calldata.at(-1),entrypoint === "create_invite" ? "0x55" : "0x44");
  assert.equal(calls[1].calldata.at(-2),"0x1");
  assert.deepEqual(calls.at(-1).calldata,[c.adapter,"0x0","0x0"]);
 }
 const calls=buildPublicRailCalls([fund(c.treasury,"1000000000000000000"),invoke(c.privateEscrowHelper,payload)],c,meta);
 assert.equal(calls[1].entrypoint,"post_escrow_action");
 assert.equal(BigInt(calls[1].calldata.at(-2)),10n**18n);
});
test("public escrow funding binds payee and preserves whole principal+fee approval",()=>{
 const data=Array.from({length:22},()=>"1");data[18]=c.feeToken;data[19]="100";data[20]="2";data[21]="${openNoteIds[0]}";
 const calls=buildPublicRailCalls([fund(c.escrowRekber,"102"),open,invoke(c.escrowRekber,data)],c,{payee:"0x777"});
 assert.equal(calls[1].entrypoint,"fund_custody");
 assert.equal(calls[1].calldata.at(-1),"0x777");
 assert.equal(BigInt(calls[0].calldata[1]),102n);
 assert.throws(()=>buildPublicRailCalls([invoke(c.escrowRekber,data)],c,meta),/address/);
});
test("all existing Rekber lifecycle actions route to escrow, not direct transfers",()=>{
 for(const action of [2,3,4,5,6,7,8,9,10]){
  const calls=buildPublicRailCalls([invoke(c.escrowRekber,[String(action),"7","8","1"])],c,meta);
  assert.equal(calls.find(call=>call.contractAddress===c.adapter).entrypoint,"act_custody");
  assert.equal(calls.some(call=>call.entrypoint==="transfer"),false);
  assert.equal(calls.some(call=>call.entrypoint==="approve"),[4,5,6,7,10].includes(action));
 }
});
test("public account nonce replaces private replay dust",()=>{
 const calls=buildPublicRailCalls([fund(c.treasury,"10"),invoke(c.escrowRekber,["3","7","8","9"])],c,meta);
 assert.equal(calls.length,1);
 assert.equal(calls[0].entrypoint,"act_custody");
});
test("reject arbitrary helper, malformed envelope, unknown action and unguarded invite consume",()=>{
 assert.throws(()=>buildPublicRailCalls([invoke("0x666",payload)],c,meta),/unregistered/);
 assert.throws(()=>publicInvokePayload({type:"invoke",calldata:["2","1"]}),/length/);
 assert.throws(()=>buildPublicRailCalls([{type:"deposit",token:c.feeToken,amount:"1"}],c,meta),/Unsupported/);
 assert.throws(()=>buildPublicRailCalls([invoke(c.invite,["1","7"])],c,meta),/signed capability/);
});
test("account mode scoping preserves bound methods, isolates wallets, defaults legacy Shield",()=>{
 const original={address:"0xabc", ping(){return this.address;}};
 const pub=accountForMode(original,"unshield","room1");
 const shield=accountForMode(original,"shield","room2");
 assert.equal(pub.ping(),original.address);
 assert.equal(transactionModeOf(pub),"unshield");
 assert.equal(transactionModeOf(shield),"shield");
 assert.equal(transactionModeOf(original),"shield");
 assert.equal(parseTransactionMode(undefined),"shield");
 assert.throws(()=>parseTransactionMode("public"));
});


test("persisted room rail rejects corrupt/conflicting values without a Shield fallback", async()=>{
 const {resolvePersistedRoomMode}=await import("../frontend/lib/starknet/roomMode.ts");
 assert.equal(resolvePersistedRoomMode([{id:"old"}],"old",null),"shield");
 assert.equal(resolvePersistedRoomMode([{id:"r",transactionMode:"unshield"}],"r","unshield"),"unshield");
 assert.throws(()=>resolvePersistedRoomMode([{id:"r",transactionMode:"unshiled"}],"r",null));
 assert.throws(()=>resolvePersistedRoomMode([{id:"r",transactionMode:"unshield"}],"r","shield"));
 assert.throws(()=>resolvePersistedRoomMode([],"r","bad"));
 assert.throws(()=>resolvePersistedRoomMode({},"r",null));
});
