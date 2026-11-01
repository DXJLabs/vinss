import test from "node:test";
import assert from "node:assert/strict";
import { RpcProvider, ec, hash, shortString, type WalletAccountV6 } from "starknet";
Object.assign(process.env, {
  NEXT_PUBLIC_STARKNET_NETWORK: "sepolia", NEXT_PUBLIC_RPC_URL: "http://127.0.0.1:1",
  NEXT_PUBLIC_PRIVACY_POOL_ADDRESS: "0x10", NEXT_PUBLIC_INVITE_ADDRESS: "0x11",
  NEXT_PUBLIC_MESSAGE_HELPER_ADDRESS: "0x12", NEXT_PUBLIC_OFFER_HELPER_ADDRESS: "0x13",
  NEXT_PUBLIC_PRIVATE_ESCROW_HELPER_ADDRESS: "0x14", NEXT_PUBLIC_ESCROW_REKBER_ADDRESS: "0x15",
  NEXT_PUBLIC_MESSAGE_HELPER_OPEN_NOTE_TOKEN: "0x30", NEXT_PUBLIC_STRK_ADDRESS: "0x30",
  NEXT_PUBLIC_VINSS_TREASURY_ADDRESS: "0x31", NEXT_PUBLIC_UNSHIELD_ADAPTER_ADDRESS: "0x20",
  NEXT_PUBLIC_UNSHIELD_INVITE_ADDRESS: "0x21", NEXT_PUBLIC_UNSHIELD_MESSAGE_HELPER_ADDRESS: "0x22",
  NEXT_PUBLIC_UNSHIELD_OFFER_HELPER_ADDRESS: "0x23", NEXT_PUBLIC_UNSHIELD_ESCROW_HELPER_ADDRESS: "0x24",
  NEXT_PUBLIC_UNSHIELD_REKBER_ADDRESS: "0x25", NEXT_PUBLIC_UNSHIELD_FEE_POLICY_ADDRESS: "0x40",
  NEXT_PUBLIC_UNSHIELD_BACKEND_URL: "https://public.invalid",
  NEXT_PUBLIC_SHIELD_INVITE_OVERRIDE_ADDRESS: "0x51",
  NEXT_PUBLIC_PUBLIC_INVITE_PROFILE: JSON.stringify({ adapter:"0x60",invite:"0x61",messageHelper:"0x62",offerHelper:"0x63",privateEscrowHelper:"0x64",escrowRekber:"0x65",feePolicy:"0x70" }),
});
test("Invite-only deployment charges lower mode-specific fees and retains both old Invite routes", async t => {
  const { accountForMode, bindAccountWallet } = await import("../lib/starknet/transactionMode");
  const invitation = await import("../lib/deal-room/invitation");
  const publicInvite = await import("../lib/starknet/publicInvite");
  const fees = await import("../lib/starknet/feePolicy");
  const { PUBLIC_RAIL_ADDRESS, PUBLIC_CONTRACTS } = await import("../lib/starknet/constants");
  const chain="0x534e5f5345504f4c4941";
  const shield: any[][] = [], calls: any[][] = [];
  let foundAt="0x60";
  const owner={address:"0xabc",async strk20InvokeTransaction(actions:any[]){shield.push(actions);return {transaction_hash:"0x1"};},async execute(items:any){calls.push(Array.isArray(items)?items:[items]);return {transaction_hash:"0x2"};}} as unknown as WalletAccountV6;
  bindAccountWallet(owner,{features:{"starknet:walletApi":{request:async()=>chain}}});
  const a=accountForMode(owner,"shield"), b=accountForMode(owner,"unshield");
  t.mock.method(RpcProvider.prototype,"getChainId",async()=>chain);
  t.mock.method(RpcProvider.prototype,"callContract",async(call:any)=>{
    if(call.entrypoint==="get_configuration")return call.contractAddress==="0x60"?["8","0x31","0x30","0x61","0x62","0x63","0x64","0x65","0x70"]:["8","0x31","0x30","0x21","0x22","0x23","0x24","0x25","0x40"];
    if(call.entrypoint==="get_fee_policy")return [call.contractAddress==="0x51"?"0x71":call.contractAddress==="0x61"?"0x70":"0x40"];
    if(call.entrypoint==="quote_fee")return [call.contractAddress==="0x71"?"20000000000000000":call.contractAddress==="0x70"?"10000000000000000":"50000000000000000"];
    if(call.entrypoint==="quote_fee_usd_micros")return [call.contractAddress==="0x71"?"20000":"10000"];
    if(call.entrypoint==="get_invite")return [String(Math.floor(Date.now()/1000)+3600),"0",call.contractAddress===foundAt?"1":"0"];
    if(call.entrypoint==="get_invite_consumer")return [call.contractAddress===foundAt?owner.address:"0x0"];
    throw new Error("Unexpected read: "+call.entrypoint);
  });
  assert.equal(await fees.quoteRoomActivationFee(a),20000000000000000n);
  assert.equal(await fees.quoteRoomActivationFee(b),10000000000000000n);
  assert.deepEqual(await fees.quoteRoomActivationDetails(a),{fee:20000000000000000n,usdMicros:20000n});
  assert.deepEqual(await fees.quoteRoomActivationDetails(b),{fee:10000000000000000n,usdMicros:10000n});
  assert.equal(await fees.quoteMessageFee(b),50000000000000000n,"non-Invite helper selection remains unchanged");
  foundAt="0x51";
  await invitation.createInviteToken(a,{scope:"direct",roomId:"room",roomSecret:"secret",label:"test"});
  assert.equal(shield.at(-1)?.[0].recipient,"0x51");
  assert.equal(shield.at(-1)?.[0].amount,"0x470de4df820000");
  foundAt="0x60";
  const token=await invitation.createInviteToken(b,{scope:"direct",roomId:"room",roomSecret:"secret",label:"test"});
  const decoded=await invitation.decodeInviteToken(token.token,token.key);
  assert.equal(decoded?.publicRailAddress,"0x60");
  assert.deepEqual(calls.at(-1)?.map(call=>call.entrypoint),["approve","create_invite","approve"]);
  assert.ok(calls.at(-1)?.every(call=>call.entrypoint==="approve"?call.calldata[0]==="0x60":call.contractAddress==="0x60"));
  await invitation.consumeInviteOnchain(b,decoded!.onchainSecret,decoded!.publicInviteCommitment,"0x60");
  assert.equal(calls.at(-1)?.[0].contractAddress,"0x60");
  foundAt="0x20";
  const profile = process.env.NEXT_PUBLIC_PUBLIC_INVITE_PROFILE!;
  delete process.env.NEXT_PUBLIC_PUBLIC_INVITE_PROFILE;
  const oldToken = await invitation.createInviteToken(b,{scope:"direct",roomId:"old-room",roomSecret:"old-secret",label:"legacy"});
  process.env.NEXT_PUBLIC_PUBLIC_INVITE_PROFILE = profile;
  assert.equal((await invitation.decodeInviteToken(oldToken.token,oldToken.key))?.publicRailAddress,"0x20");
  const beforeMismatch = calls.length;
  process.env.NEXT_PUBLIC_PUBLIC_INVITE_PROFILE = JSON.stringify({...JSON.parse(profile),messageHelper:"0x99"});
  await assert.rejects(invitation.createInviteToken(b,{scope:"direct",roomId:"room",roomSecret:"secret",label:"test"}),/configuration does not match/);
  assert.equal(calls.length,beforeMismatch,"no approval can execute for a mismatched Invite adapter");
  process.env.NEXT_PUBLIC_PUBLIC_INVITE_PROFILE = profile;
  const secret="0x123",old=publicInvite.computePublicInviteCapability(secret,owner.address,"0x20");
  assert.equal(old.commitment,hash.computePoseidonHashOnElements([shortString.encodeShortString("VINSS_PUBLIC_INVITE_V1"),chain,"0x20",owner.address,ec.starkCurve.getStarkKey(secret)]));
  assert.equal((await invitation.getInviteOnchainStateForSecret(secret,b,old.commitment,"0x20")).exists,true);
  await invitation.consumeInviteOnchain(b,secret,old.commitment,"0x20");
  assert.equal(calls.at(-1)?.[0].contractAddress,"0x20");
  await assert.rejects(invitation.consumeInviteOnchain(b,secret,old.commitment,"0x99"),/deployment/i);
  foundAt="0x11";
  await invitation.consumeInviteOnchain(a,secret);
  assert.equal(shield.at(-1)?.find(action=>action.type==="invoke").contract,"0x11");
  assert.equal(PUBLIC_RAIL_ADDRESS,"0x20");
  assert.equal(PUBLIC_CONTRACTS.escrowRekber,"0x25","funded custody deployment must remain unchanged");
});
