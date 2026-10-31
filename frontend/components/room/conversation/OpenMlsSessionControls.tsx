"use client";
import type { MlsDirectControls } from "@/hooks/room/useStarknetDirectMls";
export function OpenMlsSessionControls({ controls, busy }: {
    controls: MlsDirectControls;
    busy: boolean;
}) {
    const disabled = busy || controls.busy;
    const action = (run: () => Promise<void>) => { void run().catch(() => undefined); };
    return <details open={!controls.ready} className="border-x border-b border-wire/70 bg-[#090f13] px-4 py-2.5">
   <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs text-paper/65 [&::-webkit-details-marker]:hidden">
     <span>OpenMLS</span>
     <span className={controls.ready ? "text-signal" : "text-amber"}>{controls.ready ? "Secure session active" : controls.busy ? "Preparing…" : controls.pending ? "Pending publication" : "Setup required"}</span>
   </summary>
   <div className="mt-3 space-y-2">
     {!controls.ready && <p className="text-[10px] leading-relaxed text-paper/45">Both wallets publish keys. The designated wallet starts the session; the other wallet syncs its Welcome. New chat text requires this secure session.</p>}
     <div className="flex flex-wrap gap-2">
       {!controls.ready && <button type="button" disabled={disabled} onClick={() => action(controls.activate)} className="rounded-lg border border-signal/25 px-3 py-2 text-[10px] text-signal disabled:opacity-35">Publish keys</button>}
       {!controls.ready && controls.canInvite && controls.status === "peer-ready" && <button type="button" disabled={disabled} onClick={() => action(controls.invite)} className="rounded-lg bg-signal px-3 py-2 text-[10px] text-ink disabled:opacity-35">Start secure session</button>}
       <button type="button" disabled={disabled} onClick={() => action(controls.sync)} className="rounded-lg border border-wire px-3 py-2 text-[10px] text-paper/55 disabled:opacity-35">Sync MLS</button>
       {controls.pending && <button type="button" disabled={disabled} onClick={() => action(controls.resume)} className="rounded-lg border border-amber/30 px-3 py-2 text-[10px] text-amber disabled:opacity-35">Resume pending action</button>}
     </div>
     {controls.status === "peer-ready" && !controls.canInvite && <p className="text-[10px] text-paper/40">Waiting for your peer to start the session.</p>}
     {controls.error && <p role="status" className="break-words text-[10px] leading-relaxed text-danger">{controls.error}</p>}
     <p className="text-[9px] leading-relaxed text-paper/30">Setup and larger packets can require multiple transactions. Review the count before approving. Legacy history stays readable. Attachments, group chat, Offer and Escrow Rekber use their separate encryption; OpenMLS currently protects direct chat text. Keep this browser’s storage to retain the MLS session.</p>
   </div>
 </details>;
}
