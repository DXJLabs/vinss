import test from "node:test";
import assert from "node:assert/strict";
import {
  createSignedMlsKeyPackage,
  verifySignedMlsKeyPackage,
} from "../frontend/lib/openmls-core/starknet-keypackage-attestation.ts";

const now=1761230000000;
const alice="0x123";
const shape={
  chainId:"0x534e5f5345504f4c4941",
  roomId:"room_1",
  walletAddress:alice,
  installationId:"phone_a",
  keyPackage:Uint8Array.from([0,1,2,0,255,32,78]),
  issuedAt:now,
  expiresAt:now+600000,
};
const signer=async () => ["0x7","0x8"];
const verifier=async (_typed,signature,wallet) =>
  wallet===alice&&signature[0]==="0x7"&&signature[1]==="0x8";
test("authenticated MLS package survives binary zeros, verifies wallet-scoped proof",async()=>{
 const signed=await createSignedMlsKeyPackage(shape,signer);
 assert.deepEqual(signed.signature,["0x7","0x8"]);
 const verified=await verifySignedMlsKeyPackage(signed,{
  chainId:shape.chainId,roomId:shape.roomId,expectedWalletAddress:alice,now:now+1000,
 },verifier);
 assert.deepEqual(verified,shape.keyPackage);
});
test("attestations reject missing signer verification, expired or cross-network package",async()=>{
 const signed=await createSignedMlsKeyPackage(shape,signer);
 await assert.rejects(verifySignedMlsKeyPackage(signed,{
  chainId:shape.chainId,roomId:shape.roomId,expectedWalletAddress:alice,now,
 },undefined),/verifier|verify/i);
 await assert.rejects(verifySignedMlsKeyPackage(signed,{
  chainId:shape.chainId,roomId:shape.roomId,expectedWalletAddress:alice,now:now+700000
 },verifier),/expired|time/i);
 await assert.rejects(verifySignedMlsKeyPackage(signed,{
  chainId:"0x534e5f4d41494e",roomId:shape.roomId,expectedWalletAddress:alice,now
 },verifier),/chain|network/i);
 await assert.rejects(verifySignedMlsKeyPackage(signed,{
  chainId:shape.chainId,roomId:"elsewhere",expectedWalletAddress:alice,now
 },verifier),/room/i);
});
test("tampering bytes, signature, installation, address or replay scope is rejected",async()=>{
 const signed=await createSignedMlsKeyPackage(shape,signer);
 const opts={chainId:shape.chainId,roomId:shape.roomId,expectedWalletAddress:alice,now};
 const verifierBound=async (typed,signature,wallet) =>
   signature[0]==="0x7"&&signature[1]==="0x8"&&wallet===alice&&typed.message.installation===signed.installationHash;
 await assert.rejects(verifySignedMlsKeyPackage({...signed,keyPackage:signed.keyPackage+"A"},opts,verifierBound));
 await assert.rejects(verifySignedMlsKeyPackage({...signed,signature:["0x9","0x8"]},opts,verifierBound));
 await assert.rejects(verifySignedMlsKeyPackage({...signed,installationId:"evil"},opts,verifierBound));
 await assert.rejects(verifySignedMlsKeyPackage(signed,{...opts,expectedWalletAddress:"0x999"},verifierBound));
});
