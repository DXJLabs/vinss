import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const env=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>line.split(/=(.*)/s).slice(0,2)));
test('Invite activation preserves every existing v2 deployment and custody variable',()=>{
  const old=env(read('deployments/sepolia/fees-v2/frontend.env'));
  const next=env(read('deployments/sepolia/invite-fees-v3/frontend.env'));
  for(const [key,value] of Object.entries(old))assert.equal(next[key],value,'changed '+key);
  assert.deepEqual(Object.keys(next).filter(key=>!(key in old)).sort(),['NEXT_PUBLIC_PUBLIC_INVITE_PROFILE','NEXT_PUBLIC_SHIELD_INVITE_OVERRIDE_ADDRESS']);
  assert.equal(next.NEXT_PUBLIC_STARKNET_NETWORK,'sepolia');
});
test('Invite profile uses verified staged helpers with exact new prices',()=>{
  const next=env(read('deployments/sepolia/invite-fees-v3/frontend.env'));
  const native=JSON.parse(read('deployments/sepolia/invite-fees-v3/shield-manifest.json'));
  const pub=JSON.parse(read('deployments/sepolia/invite-fees-v3/public-manifest.json'));
  const proof=JSON.parse(read('deployments/sepolia/invite-fees-v3/verification.json'));
  assert.equal(native.verified,true); assert.equal(pub.verified,true);
  assert.equal(next.NEXT_PUBLIC_SHIELD_INVITE_OVERRIDE_ADDRESS,native.contracts.VinssInvite.address);
  const profile=JSON.parse(next.NEXT_PUBLIC_PUBLIC_INVITE_PROFILE);
  assert.equal(profile.adapter,pub.contracts.VinssPublicRail.address);
  assert.equal(profile.invite,pub.contracts.VinssInvite.address);
  assert.equal(profile.feePolicy,pub.contracts.VinssPublicAppFeePolicy.address);
  assert.equal(proof.shieldUsdMicros,'20000');assert.equal(proof.unshieldUsdMicros,'10000');
  assert.equal(BigInt(proof.unshieldWei),(BigInt(proof.shieldWei)+1n)/2n);
});
