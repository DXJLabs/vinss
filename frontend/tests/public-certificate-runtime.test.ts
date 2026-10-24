import test from "node:test";
import assert from "node:assert/strict";
Object.assign(process.env, {
  NEXT_PUBLIC_STARKNET_NETWORK:"sepolia", NEXT_PUBLIC_RPC_URL:"http://127.0.0.1:1",
  NEXT_PUBLIC_SETTLEMENT_CERTIFICATE_ADDRESS:"0x51", NEXT_PUBLIC_UNSHIELD_CERTIFICATE_ADDRESS:"0x61",
});
test("certificate metadata and artwork preserve the selected rail and reject invalid rails",async()=>{
  const {NextRequest}=await import("next/server");
  const {getProvider}=await import("../lib/starknet/walletClient");
  const metadata=await import("../app/api/certificates/[tokenId]/route");
  const publicMetadata=await import("../app/api/public-certificates/[tokenId]/route");
  const artwork=await import("../app/api/certificates/[tokenId]/image/route");
  const reads:string[]=[];
  const provider=getProvider();const original=provider.callContract;
  provider.callContract=(async(call:{contractAddress:string})=>{
    reads.push(call.contractAddress);return ["0x1","0x2","0x1","0xabc","0x4","0x5"];
  }) as typeof provider.callContract;
  const context={params:Promise.resolve({tokenId:"1"})};
  try{
    const pub=await publicMetadata.GET(new NextRequest("https://fixture.invalid/api/public-certificates/1"),context);
    assert.equal(pub.status,200);const data=await pub.json();
    assert.equal(data.external_url,"https://fixture.invalid/certificate/1?rail=unshield");
    assert.equal(data.image,"https://fixture.invalid/api/certificates/1/image?rail=unshield");
    assert.equal((await artwork.GET(new Request(data.image),context)).status,200);
    assert.equal(reads.at(-1),"0x61");
    const shield=await metadata.GET(new NextRequest("https://fixture.invalid/api/certificates/1"),context);
    const legacy=await shield.json();assert.match(legacy.external_url,/rail=shield/);
    assert.equal((await artwork.GET(new Request(legacy.image),context)).status,200);
    assert.equal(reads.at(-1),"0x51");
    const before=reads.length;
    assert.equal((await artwork.GET(new Request("https://fixture.invalid/api/certificates/1/image?rail=wrong"),context)).status,400);
    assert.equal((await metadata.GET(new NextRequest("https://fixture.invalid/api/certificates/1?rail=wrong"),context)).status,400);
    assert.equal(reads.length,before);
  }finally{provider.callContract=original;}
});
