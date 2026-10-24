/**
 * Starknet Shield and public Unshield are explicit ciphertext messaging rails.
 * A Canton/EVM transport must be independently implemented, tested and
 * registered before user selection; no silent Starknet fallback.
 */
import { transactionModeOf } from "@/lib/starknet/transactionMode";
import { PUBLIC_BACKEND_URL, NETWORK } from "@/lib/starknet/constants";
import {
  sendMessage as nativeSend,
  discoverMessages as nativeDiscover,
} from "@/lib/deal-room/messaging";
import { MessageTransportRouter, makeMessageTransportId } from "@/lib/deal-room/messageTransport";

type SendArgs = Parameters<typeof nativeSend>;
type SendResult = Awaited<ReturnType<typeof nativeSend>>;
type DiscoverArgs = Parameters<typeof nativeDiscover>;
type DiscoverResult = Awaited<ReturnType<typeof nativeDiscover>>;

const nativeId = makeMessageTransportId("starknet", NETWORK, "strk20");
const publicId = makeMessageTransportId("starknet", NETWORK, "public");
const router = new MessageTransportRouter<SendArgs,SendResult,DiscoverArgs,DiscoverResult>();
router.register({
  id: nativeId,
  send: (args) => nativeSend(...args),
  discover: (args) => nativeDiscover(...args),
});
router.register({ id: publicId, send: (args) => nativeSend(...args), discover: (args) => nativeDiscover(...args) });
function currentTransport(publicMode = false): string {
  return publicMode ? process.env.NEXT_PUBLIC_PUBLIC_MESSAGE_TRANSPORT_ID ?? publicId : process.env.NEXT_PUBLIC_MESSAGE_TRANSPORT_ID ?? nativeId;
}
export function sendMessage(...args:SendArgs):Promise<SendResult> {
  return router.send(currentTransport(transactionModeOf(args[0]) === "unshield"),args);
}
export function discoverMessages(...args:DiscoverArgs):Promise<DiscoverResult> {
  return router.discover(currentTransport(Boolean(PUBLIC_BACKEND_URL) && args[0].replace(/\/$/, "") === PUBLIC_BACKEND_URL.replace(/\/$/, "")),args);
}
