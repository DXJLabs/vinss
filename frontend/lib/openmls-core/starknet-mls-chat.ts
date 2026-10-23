"use client";

/**
 * Native Starknet STRK20 + OpenMLS chat orchestration.
 *
 * - MLS keys and epoch state live in OpenMLS WASM + encrypted IndexedDB.
 * - MessageHelper sees AES-GCM-encrypted MLS frames and opaque routing tags.
 * - Wallet-signed KeyPackages are verified ON STARKNET using account contract.
 * - Existing room/direct ECDH transport is a compatibility wrapper ONLY,
 *   never treated as MLS identity authentication or primary MLS encryption.
 * - Pending commits are never merged on wallet callbacks alone.
 */
import type { WalletAccountV6 } from "starknet";
import { getProvider } from "@/lib/starknet/walletClient";
import { canonicalStarknetAddress } from "@/lib/privacy/participantKeys";
import {
  createStarknetOpenMlsSession,
  type StarknetOpenMlsSessionInput,
} from "./starknet-session";
import {
  readStarknetMlsOnchain, sendStarknetMlsOnchain,
  type StarknetMlsOnchainContext,
} from "./starknet-onchain-transport";
import type { StarknetMlsPacket } from "./starknet-framing";
import type { BrowserOpenMlsBridge } from "./openmls/browser-bridge";
import type { GroupMember } from "./types";
import {
  createSignedMlsKeyPackage,
  verifySignedMlsKeyPackage,
  type SignedMlsKeyPackage,
  type MlsWalletVerifier,
} from "./starknet-keypackage-attestation";

function normalizeSignature(signature: unknown): string[] {
  if (Array.isArray(signature)) {
    const value=signature.map(x => String(x));
    if (value.length >= 2 && value.every(x=>/^0x[0-9a-fA-F]+$/.test(x))) return value;
  }
  if (signature && typeof signature==="object" && "r" in signature && "s" in signature) {
    const sig=signature as {r:string|bigint;s:string|bigint};
    return [BigInt(sig.r).toString(16),BigInt(sig.s).toString(16)].map(x=>"0x"+x);
  }
  throw new Error("Wallet did not provide a supported Starknet typed-data signature.");
}
function bytesFromJson(data:unknown):Uint8Array {
  return new TextEncoder().encode(JSON.stringify(data));
}
function jsonFromBytes<T>(bytes:Uint8Array):T {
  if(bytes.length>16*1024)throw new Error("MLS packet exceeds maximum plaintext envelope.");
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as T;
}
function identityId(input:StarknetOpenMlsSessionInput):string {
  return [
    input.chainId,input.roomId,
    canonicalStarknetAddress(input.walletAddress),
    input.installationId,
  ].join(":");
}
function memberFromScope(input:StarknetOpenMlsSessionInput,role:"admin"|"member"):GroupMember {
  const id=identityId(input);
  return {
    userId:canonicalStarknetAddress(input.walletAddress),
    installationId:id,
    credential:new TextEncoder().encode(id),
    role,
  };
}
function compareBytes(a:Uint8Array,b:Uint8Array):boolean {
  if(a.length!==b.length)return false;
  let match=0;for(let i=0;i<a.length;i++)match|=a[i]!^b[i]!;
  return match===0;
}
export interface MlsPlaintextMessage {
  version: 1;
  type: "message";
  from: string;
  to: string;
  sentAt: number;
  body: string;
}
export interface MlsInboxMessage {
  packetId:string;
  sender:string;
  message:MlsPlaintextMessage;
}
export interface MlsTransportConfirmation {
  /** Verifies exact accepted and indexed encrypted payload, not wallet callback alone. */
  (kind:"key_package"|"welcome"|"commit"|"application",bytes:Uint8Array):Promise<void>;
}
export class StarknetOpenMlsChat {
  private readonly seenPackets=new Set<string>();
  private constructor(
    readonly bridge:BrowserOpenMlsBridge,
    readonly ownScope:StarknetOpenMlsSessionInput,
    readonly transport:StarknetMlsOnchainContext,
    readonly peerAddress:string,
  ) {}
  static async initialize(input:{
    identity:StarknetOpenMlsSessionInput;
    peerAddress:string;
    transport:StarknetMlsOnchainContext;
  }):Promise<StarknetOpenMlsChat> {
    if (input.identity.chainId!==input.transport.network ||
        input.identity.roomId!==input.transport.roomId ||
        canonicalStarknetAddress(input.identity.walletAddress)!==
          canonicalStarknetAddress(input.transport.account.address)) {
      throw new Error("OpenMLS session scope does not match Starknet signing context.");
    }
    const peer=canonicalStarknetAddress(input.peerAddress);
    if(!peer || peer===canonicalStarknetAddress(input.identity.walletAddress)) {
      throw new Error("OpenMLS Direct requires a different verified peer wallet.");
    }
    if(input.transport.scope!=="direct"||
       !input.transport.outboundRoute?.recipientIdentity||
       canonicalStarknetAddress(input.transport.outboundRoute.recipientIdentity)!==peer||
       !input.transport.inboundRoutes?.length) {
      throw new Error("OpenMLS Direct requires explicit authenticated peer routing.");
    }
    const bridge=await createStarknetOpenMlsSession(input.identity);
    return new StarknetOpenMlsChat(bridge,input.identity,input.transport,peer);
  }
  static async walletVerifier(typedData: Parameters<MlsWalletVerifier>[0],
    signature: readonly string[],walletAddress:string):Promise<boolean> {
    try {
      return await getProvider().verifyMessageInStarknet(
        typedData,[...signature],walletAddress,
      );
    } catch {
      return false;
    }
  }
  private async packets():Promise<StarknetMlsPacket[]> {
    const result=await readStarknetMlsOnchain(this.transport);
    if(result.rejected.length) {
      throw new Error("OpenMLS ciphertext fragment integrity check failed.");
    }
    return result.complete;
  }
  private async peerKeyPackage():Promise<{
    payload:SignedMlsKeyPackage;bytes:Uint8Array;
  }|null> {
    const packets=await this.packets();
    const peer=packets.filter(x=>
      x.kind==="key_package" &&
      canonicalStarknetAddress(x.sender)===this.peerAddress
    );
    // Prefer latest valid package. Never trust an expired, forged or unmatched
    // packet; a missing verifiable package blocks the MLS invitation.
    for(const pkt of peer.slice().reverse()) {
      let candidate:SignedMlsKeyPackage;
      try {candidate=jsonFromBytes<SignedMlsKeyPackage>(pkt.bytes);} catch {continue;}
      try {
        const bytes=await verifySignedMlsKeyPackage(candidate,{
          chainId:this.ownScope.chainId,
          roomId:this.ownScope.roomId,
          expectedWalletAddress:this.peerAddress,
        },StarknetOpenMlsChat.walletVerifier);
        return {payload:candidate,bytes};
      }catch {continue;}
    }
    return null;
  }
  async publishKeyPackage(confirm: MlsTransportConfirmation,
    confirmMultipleTransactions:(count:number,kind:string)=>Promise<boolean>):Promise<void> {
    const packageBytes=await this.bridge.createKeyPackage();
    const now=Date.now();
    const attested=await createSignedMlsKeyPackage({
      chainId:this.ownScope.chainId,roomId:this.ownScope.roomId,
      walletAddress:this.ownScope.walletAddress,
      installationId:this.ownScope.installationId,
      keyPackage:packageBytes,
      issuedAt:now,expiresAt:now+60*60*1000,
    },async typedData=>normalizeSignature(
      await this.transport.account.signMessage(typedData),
    ));
    await verifySignedMlsKeyPackage(attested,{
      chainId:this.ownScope.chainId,roomId:this.ownScope.roomId,
      expectedWalletAddress:this.ownScope.walletAddress,
    },StarknetOpenMlsChat.walletVerifier);
    const bytes=bytesFromJson(attested);
    await sendStarknetMlsOnchain(this.transport,{
      kind:"key_package",ciphertext:bytes,
      confirmMultipleTransactions,
    });
    await confirm("key_package",bytes);
  }
  async hasVerifiedPeerKeyPackage():Promise<boolean> {
    return (await this.peerKeyPackage())!==null;
  }
  /**
   * New two-party MLS group. Both users should publish signed packages.
   * Sender commits its local epoch only after full on-chain Welcome proof.
   */
  async invitePeer(conversationId:string,confirm:MlsTransportConfirmation,
    confirmMultipleTransactions:(count:number,kind:string)=>Promise<boolean>):Promise<void> {
    const peer=await this.peerKeyPackage();
    if(!peer)throw new Error("The peer has no wallet-verified MLS KeyPackage.");
    try {
      await this.bridge.getGroupSnapshot(conversationId);
    }catch{
      await this.bridge.createGroup({
        conversationId,title:"VINSS private deal",
        creator:memberFromScope(this.ownScope,"admin"),
      });
    }
    const peerScope:StarknetOpenMlsSessionInput={
      chainId:peer.payload.chainId,roomId:peer.payload.roomId,
      walletAddress:peer.payload.walletAddress,
      installationId:peer.payload.installationId,
    };
    const {welcome}=await this.bridge.prepareAddMember({
      conversationId,
      member:memberFromScope(peerScope,"member"),
      keyPackage:peer.bytes,
    });
    await sendStarknetMlsOnchain(this.transport,{
      kind:"welcome",ciphertext:welcome,confirmMultipleTransactions,
    });
    await confirm("welcome",welcome);
    await this.bridge.mergePendingCommit(conversationId);
  }
  async joinFromPeerWelcome(conversationId:string):Promise<boolean> {
    if(!(await this.peerKeyPackage())) {
      throw new Error("Peer has not published a verifiable signed KeyPackage.");
    }
    const result=await this.packets();
    const incoming=result.filter(x=>
      x.kind==="welcome"&&
      canonicalStarknetAddress(x.sender)===this.peerAddress
    );
    if(!incoming.length)return false;
    // If the welcome has already been processed, do not fork an MLS epoch.
    try {
      await this.bridge.getGroupSnapshot(conversationId);
      return true;
    }catch {}
    const last=incoming.at(-1)!;
    await this.bridge.joinFromWelcome({
      welcome:last.bytes,conversationId,handshakeId:last.packetId,
    });
    return true;
  }
  async isReady(conversationId:string):Promise<boolean> {
    try {const group=await this.bridge.getGroupSnapshot(conversationId);
      return group.epoch > 0n;
    }catch{return false;}
  }
  async sendText(conversationId:string,body:string,
    confirm:MlsTransportConfirmation,
    confirmMultipleTransactions:(count:number,kind:string)=>Promise<boolean>):Promise<MlsPlaintextMessage> {
    if(!await this.isReady(conversationId))throw new Error("MLS epoch is not initialized.");
    if(!body.trim()||body.length>3000)throw new Error("MLS message length is invalid.");
    const message:MlsPlaintextMessage={
      version:1,type:"message",
      from:canonicalStarknetAddress(this.ownScope.walletAddress),
      to:this.peerAddress,sentAt:Date.now(),body:body.trim(),
    };
    const {ciphertext}=await this.bridge.encryptApplicationMessage({
      conversationId,plaintext:bytesFromJson(message),
    });
    await sendStarknetMlsOnchain(this.transport,{
      kind:"application",ciphertext,confirmMultipleTransactions,
    });
    await confirm("application",ciphertext);
    return message;
  }
  async receiveTexts(conversationId:string):Promise<MlsInboxMessage[]> {
    if(!await this.isReady(conversationId))return [];
    const packets=await this.packets();
    const incoming: MlsInboxMessage[]=[];
    for(const packet of packets){
      if(packet.kind!=="application"||
         canonicalStarknetAddress(packet.sender)!==this.peerAddress||
         this.seenPackets.has(packet.packetId))continue;
      const {plaintext}=await this.bridge.decryptApplicationMessage({
        conversationId,ciphertext:packet.bytes,
      });
      const message=jsonFromBytes<MlsPlaintextMessage>(plaintext);
      if(message.version!==1||message.type!=="message"||
         canonicalStarknetAddress(message.from)!==this.peerAddress||
         canonicalStarknetAddress(message.to)!==
           canonicalStarknetAddress(this.ownScope.walletAddress)||
         typeof message.body!=="string"||!message.body.trim()||
         !Number.isSafeInteger(message.sentAt)){
        throw new Error("Invalid authenticated MLS application payload.");
      }
      this.seenPackets.add(packet.packetId);
      incoming.push({packetId:packet.packetId,sender:packet.sender,message});
    }
    return incoming;
  }
  async confirmIndexed(kind:"key_package"|"welcome"|"commit"|"application",
    bytes:Uint8Array,attempts=12):Promise<void> {
    for(let i=0;i<attempts;i++){
      const packets=await this.packets().catch(()=>[]);
      if(packets.some(packet=>
        packet.kind===kind &&
        canonicalStarknetAddress(packet.sender)===
          canonicalStarknetAddress(this.ownScope.walletAddress)&&
        compareBytes(packet.bytes,bytes)))return;
      await new Promise<void>(resolve=>setTimeout(resolve,1600));
    }
    throw new Error("MLS frame is not yet indexed; keep pending state and retry discovery.");
  }
  /**
   * No optimistic merge on failed RPC/indexer. On restart, the checkpoint
   * persists a pending MLS commit for explicit replay/recovery review.
   */
  async pendingCommits() {
    return this.bridge.listPendingOutboundCommits();
  }
}
