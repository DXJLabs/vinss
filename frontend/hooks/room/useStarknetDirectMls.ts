"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { walletV6, type WalletAccountV6 } from "starknet";
import { getProvider, type VinssWalletSession } from "@/lib/starknet/walletClient";
import { BACKEND_URL } from "@/lib/starknet/constants";
import { canonicalStarknetAddress } from "@/lib/privacy/participantKeys";
import type { MessagingIdentity } from "@/lib/privacy/participantKeys";
import { deriveDirectMessageKey } from "@/lib/privacy/participantKeys";
import type { MessageRoute } from "@/lib/privacy/messageRouting";
import { StarknetOpenMlsChat, type MlsInboxMessage } from "@/lib/openmls-core/starknet-mls-chat";

export type MlsDirectStatus =
  | "inactive" | "initializing" | "key-published"
  | "peer-ready" | "waiting-welcome" | "MLS_READY" | "error";

export interface MlsDirectControls {
  readonly status:MlsDirectStatus;
  readonly busy:boolean;
  readonly ready:boolean;
  readonly error:string|null;
  /** Persisted upgrade guard: never silently send a legacy message after MLS opt-in. */
  requiresMls():boolean;
  activate():Promise<void>;
  sync():Promise<void>;
  invite():Promise<void>;
  send(body:string):Promise<{
    body:string;sentAt:string;transactionHash:string;actionLocator:string;
  }>;
}
export interface UseStarknetDirectMlsInput {
  roomId:string|null;
  account:WalletAccountV6|null;
  wallet:VinssWalletSession["wallet"]|null;
  identity:MessagingIdentity|null;
  peerAddress:string|null;
  peerPublicKey:string|null;
  selfAliases:string[];
  onInbox(messages:MlsInboxMessage[]):void;
}

function normalizeId(s:string):string {
  return canonicalStarknetAddress(s);
}
async function conversationId(
  chainId:string,roomId:string,a:string,b:string,
):Promise<string> {
  const sorted=[normalizeId(a),normalizeId(b)].sort();
  const input=new TextEncoder().encode(
    ["VINSS_OPENMLS_DIRECT_V1",chainId,roomId,...sorted].join(":"),
  );
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",input));
  return "vinss-mls-" + Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("").slice(0,48);
}
function requiredKey(roomId:string|null,wallet:string|undefined,peer:string|null):string|null {
  if(!roomId || !wallet || !peer)return null;
  return [
    "vinss:mls-required:v1:",roomId,normalizeId(wallet),normalizeId(peer)
  ].join(":");
}
function installationId(roomId:string,chainId:string,wallet:string):string {
  // Public per-device label only. Cryptographic private state lives in
  // the encrypted IndexedDB OpenMLS checkpoint, never localStorage.
  const key=["vinss:mls-install:v1",chainId,roomId,normalizeId(wallet)].join(":");
  const existing=window.localStorage.getItem(key);
  if(existing && /^[0-9a-f]{32}$/.test(existing))return existing;
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  const result=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
  window.localStorage.setItem(key,result);
  return result;
}
function safeMsg(err:unknown):string {
  // Avoid surfacing potentially sensitive wallet error payloads.
  return err instanceof Error && /^MLS |^OpenMLS |^The peer |^Peer |^Wallet /.test(err.message)
    ? err.message
    : "OpenMLS operation could not be confirmed. Check the secure-session status before retrying.";
}
export function useStarknetDirectMls({
 roomId,account,wallet,identity,peerAddress,peerPublicKey,selfAliases,onInbox,
}:UseStarknetDirectMlsInput):MlsDirectControls {
  const [status,setStatus]=useState<MlsDirectStatus>("inactive");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const controller=useRef<StarknetOpenMlsChat|null>(null);
  const conversation=useRef<string>("");
  const generation=useRef(0);
  const inboxRef=useRef(onInbox);
  inboxRef.current=onInbox;
  const requiresMls=():boolean=>{
    if(typeof window==="undefined")return false;
    const key=requiredKey(roomId,account?.address,peerAddress);
    return Boolean(key && window.localStorage.getItem(key)==="1");
  };

  const identityKey=[
    roomId ?? "",account?.address ?? "",peerAddress ?? "",peerPublicKey ?? "",
    identity?.publicKey ?? "",
  ].join("|");
  useEffect(()=>{
    generation.current++;
    controller.current=null;
    conversation.current="";
    setStatus("inactive");
    setError(null);
  },[identityKey]);

  const init=useCallback(async ():Promise<{
    chat:StarknetOpenMlsChat;cid:string;
  }>=>{
    if(!account || !wallet || !identity || !roomId || !peerAddress || !peerPublicKey)
      throw new Error("MLS Direct needs an active wallet and selected participant.");
    if(controller.current && conversation.current)
      return {chat:controller.current,cid:conversation.current};
    const token=generation.current;
    const own=normalizeId(account.address),peer=normalizeId(peerAddress);
    if(!peer || own===peer)throw new Error("MLS Direct peer identity is invalid.");
    const [chainId, rpcChainId] = await Promise.all([
      walletV6.requestChainId(wallet),
      getProvider().getChainId(),
    ]);
    if(BigInt(chainId)!==BigInt(rpcChainId)) {
      throw new Error("MLS wallet and configured Starknet RPC are on different chains.");
    }
    const iid=installationId(roomId,chainId,own);
    const key=await deriveDirectMessageKey(roomId,identity.privateKey,peerPublicKey);
    const candidateIds=[own,account.address,...selfAliases,peer,peerAddress];
    const identities=[...new Set(candidateIds.map(s=>s.trim().toLowerCase()).filter(Boolean))];
    const inboundRoutes:MessageRoute[]=identities.map(name=>({
      recipientIdentity:name,encryptionKey:key,routingKey:key,
    }));
    const outboundRoute:MessageRoute={
      recipientIdentity:peerAddress,encryptionKey:key,routingKey:key,
    };
    const chat=await StarknetOpenMlsChat.initialize({
      identity:{
        chainId,roomId,walletAddress:own,installationId:iid,
      },
      peerAddress:peer,
      transport:{
        account,network:chainId,roomId,scope:"direct",
        encryptionKey:key,messagingPublicKey:identity.publicKey,
        outboundRoute,inboundRoutes,backendUrl:BACKEND_URL,
      },
    });
    const cid=await conversationId(chainId,roomId,own,peer);
    if(generation.current!==token)
      throw new Error("MLS peer or wallet changed during initialization.");
    controller.current=chat;
    conversation.current=cid;
    return {chat,cid};
  },[identityKey,wallet,selfAliases.join("|")]);

  useEffect(()=>{
    if(!requiresMls())return;
    let cancelled=false;
    setStatus("initializing");
    void init().then(async ({chat,cid})=>{
      const ready=await chat.isReady(cid);
      if(!cancelled)setStatus(ready?"MLS_READY":"waiting-welcome");
    }).catch(()=>{
      if(!cancelled){
        setStatus("error");
        setError("OpenMLS checkpoint could not be restored; legacy send is blocked.");
      }
    });
    return()=>{cancelled=true;};
  },[identityKey,init]);

  const confirmMultiple=useCallback(async(count:number,kind:string):Promise<boolean>=>{
    return window.confirm(
      "OpenMLS "+kind+" needs "+count+
      " separate STRK20 transactions, each with a fee. Continue?",
    );
  },[]);

  const sync=useCallback(async()=>{
    if(busy)return;
    setBusy(true);setError(null);
    try{
      const {chat,cid}=await init();
      if(await chat.isReady(cid)){
        setStatus("MLS_READY");
        const messages=await chat.receiveTexts(cid);
        if(messages.length)inboxRef.current(messages);
        return;
      }
      if(await chat.joinFromPeerWelcome(cid)){
        setStatus("MLS_READY");
        return;
      }
      if(await chat.hasVerifiedPeerKeyPackage()){
        setStatus("peer-ready");
      }else{
        setStatus(current=>current==="key-published"?"waiting-welcome":current==="inactive"?"inactive":"waiting-welcome");
      }
    }catch(err){setError(safeMsg(err));setStatus("error");}
    finally{setBusy(false);}
  },[init,busy]);

  const activate=useCallback(async()=>{
    if(busy)return;
    setBusy(true);setError(null);setStatus("initializing");
    try{
      const protectionKey=requiredKey(roomId,account?.address,peerAddress);
      if(!protectionKey)throw new Error("MLS conversation scope unavailable.");
      // Persist lock BEFORE any wallet prompt, preventing silent legacy
      // downgrade even if the wallet app is backgrounded or the page reloads.
      window.localStorage.setItem(protectionKey,"1");
      const {chat}=await init();
      await chat.publishKeyPackage(
        (kind,bytes)=>chat.confirmIndexed(kind,bytes),
        confirmMultiple,
      );
      setStatus("key-published");
    }catch(err){setStatus("error");setError(safeMsg(err));}
    finally{setBusy(false);}
  },[init,busy,confirmMultiple]);

  const invite=useCallback(async()=>{
    if(busy)return;
    setBusy(true);setError(null);
    try{
      const {chat,cid}=await init();
      await chat.invitePeer(
        cid,(kind,bytes)=>chat.confirmIndexed(kind,bytes),
        confirmMultiple,
      );
      if(!await chat.isReady(cid))throw new Error("MLS key epoch is not ready.");
      setStatus("MLS_READY");
    }catch(err){setStatus("error");setError(safeMsg(err));}
    finally{setBusy(false);}
  },[init,busy,confirmMultiple]);

  const send=useCallback(async(body:string)=>{
    const {chat,cid}=await init();
    if(!await chat.isReady(cid))throw new Error("MLS session is not ready.");
    const sent=await chat.sendText(
      cid,body,(kind,bytes)=>chat.confirmIndexed(kind,bytes),
      confirmMultiple,
    );
    return {
      body:sent.body,
      sentAt:new Date(sent.sentAt).toISOString(),
      transactionHash:"",
      actionLocator:crypto.randomUUID().replace(/-/g,""),
    };
  },[init,confirmMultiple]);

  useEffect(()=>{
    if(status!=="MLS_READY"||!controller.current)return;
    let stopped=false,running=false;
    const poll=async()=>{
      if(stopped||running)return;
      running=true;
      try{
        const chat=controller.current;
        if(!chat || !conversation.current)return;
        const incoming=await chat.receiveTexts(conversation.current);
        if(!stopped&&incoming.length)inboxRef.current(incoming);
      }catch{
        // Stale or replayed MLS messages fail closed. Never show raw frames.
      }finally{running=false;}
    };
    void poll();
    const timer=setInterval(()=>void poll(),7500);
    return()=>{stopped=true;clearInterval(timer);};
  },[status,identityKey]);

  return {status,busy,ready:status==="MLS_READY",error,requiresMls,activate,sync,invite,send};
}
