import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { readFileSync } from "node:fs";
import { packEncryptedBytes, recoverEncryptedByteCandidates } from "../frontend/lib/privacy/feltCodec.ts";
import { MessageTransportRouter, makeMessageTransportId } from "../frontend/lib/deal-room/messageTransport.ts";

const crypto = globalThis.crypto ?? webcrypto;
const original = (bytes) => Uint8Array.from(bytes);
const sequences = [
  [0], [0,0,0], [0,1,2], Array(30).fill(0),
  [0,...Array(29).fill(7)], [0,...Array(30).fill(7)],
  [...Array(30).fill(4),0,1],
  [...Array(59).fill(2),0],
  [...Array(60).fill(2),0,0],
  Array.from({length:800},(_,i)=>i%11===0?0:i%256),
];

test("new felt codec losslessly roundtrips leading zeros, all-zero chunks, 30-byte boundaries",()=>{
  for(const bytes of sequences){
    const value=original(bytes);
    const packed=packEncryptedBytes(value);
    const recovered=recoverEncryptedByteCandidates(packed);
    assert.equal(recovered.length,1);
    assert.deepEqual(recovered[0],value);
    assert.ok(packed.every(x=> x >=0n && x < ((1n<<251n)+17n*(1n<<192n)+1n)));
  }
});
test("new codec fails closed on malformed sentinel, length and too many chunks",()=>{
 const input=original(Array.from({length:61},(_,i)=>i));
 const packed=packEncryptedBytes(input);
 assert.throws(()=>recoverEncryptedByteCandidates([packed[0],packed[1],packed[2],0n,...packed.slice(4)]));
 assert.throws(()=>recoverEncryptedByteCandidates([packed[0],99999n,...packed.slice(2)]));
 assert.throws(()=>packEncryptedBytes(new Uint8Array(62*30+1)),/64|large|chunks/i);
 assert.throws(()=>recoverEncryptedByteCandidates([0n]),/empty|legacy|invalid/i);
});
test("legacy ciphertext candidates reconstruct full chunks and missing leading zeros",()=>{
 const raw=original([0,...Array(29).fill(10),0,0,12,13]);
 // Historical chunks carried no length marker and silently lost leading zeros.
 const old=(bytes)=>{
  const felts=[];
  for(let i=0;i<bytes.length;i+=30){
   let v=0n;
   for(const b of bytes.slice(i,i+30))v=(v<<8n)+BigInt(b);
   felts.push(v);
  }
  return felts;
 };
 const candidates=recoverEncryptedByteCandidates(old(raw));
 assert.ok(candidates.some(x=>Buffer.from(x).equals(Buffer.from(raw))));
 assert.ok(candidates.length<=30);
});
test("authenticated legacy AES-GCM can recover data with zero-leading final chunk",async()=>{
 const key=await crypto.subtle.generateKey({name:"AES-GCM",length:256},true,["encrypt","decrypt"]);
 const iv=original(Array.from({length:12},(_,i)=>i===0?0:i+1));
 const raw=new TextEncoder().encode(JSON.stringify({body:"old private message",scope:"direct"}));
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,raw));
 const bytes=new Uint8Array(iv.length+ciphertext.length);
 bytes.set(iv);bytes.set(ciphertext,iv.length);
 const old=[];for(let i=0;i<bytes.length;i+=30){let x=0n;for(const b of bytes.slice(i,i+30))x=(x<<8n)|BigInt(b);old.push(x);}
 const candidates=recoverEncryptedByteCandidates(old);
 let found=false;
 for(const candidate of candidates){
  try{
   const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:candidate.slice(0,12)},key,candidate.slice(12));
   if(Buffer.from(decrypted).equals(Buffer.from(raw)))found=true;
  }catch{}
 }
 assert.equal(found,true);
});
test("transport registry routes explicitly; no fake Canton/EVM fallback",async()=>{
 const router=new MessageTransportRouter();
 const starknet=makeMessageTransportId("starknet","sepolia","strk20");
 const canton=makeMessageTransportId("canton","devnet","daml");
 router.register({id:starknet,send:async request=>({txHash:"0x1",value:request}),discover:async()=>[{id:"a"}]});
 assert.deepEqual(router.supportedTransports(),[starknet]);
 assert.equal((await router.send(starknet,"encrypted")).value,"encrypted");
 assert.deepEqual(await router.discover(starknet),[{id:"a"}]);
 await assert.rejects(router.send(canton,"encrypted"),/not configured|unsupported|unavailable/i);
 await assert.rejects(router.discover(canton),/not configured|unsupported|unavailable/i);
 assert.throws(()=>router.register({id:starknet,send:async()=>null,discover:async()=>[]}),/already|duplicate/i);
 assert.throws(()=>makeMessageTransportId("starknet","", "strk20"),/invalid|empty/i);
});
test("active Direct/Group routes use transport gateway, and wallet errors omit sensitive payloads",()=>{
 const direct=readFileSync(new URL("../frontend/hooks/room/useDirectConversation.ts",import.meta.url),"utf8");
 const group=readFileSync(new URL("../frontend/hooks/room/useGroupConversation.ts",import.meta.url),"utf8");
 const gateway=readFileSync(new URL("../frontend/lib/deal-room/messageGateway.ts",import.meta.url),"utf8");
 const messaging=readFileSync(new URL("../frontend/lib/deal-room/messaging.ts",import.meta.url),"utf8");
 assert.match(direct,/from ["']@\/lib\/deal-room\/messageGateway["']/);
 assert.match(group,/from ["']@\/lib\/deal-room\/messageGateway["']/);
 assert.match(gateway,/MessageTransportRouter/);
 assert.match(gateway,/strk20/);
 assert.doesNotMatch(messaging,/DEBUG_PAYLOAD=|RAW_ERROR=|WALLET_ERROR_DETAIL=|rawError|safeDebugActions/);
 assert.doesNotMatch(messaging,/console\.error\([\s\S]*debugActions/);
});
