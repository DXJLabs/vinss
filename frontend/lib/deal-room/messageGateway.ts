/**
 * Only native Starknet STRK20 messaging is registered today.
 * A Canton/EVM transport must be independently implemented, tested and
 * registered before user selection; no silent Starknet fallback.
 */
import { NETWORK } from "@/lib/starknet/constants";
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
const router = new MessageTransportRouter<SendArgs,SendResult,DiscoverArgs,DiscoverResult>();
router.register({
  id: nativeId,
  send: (args) => nativeSend(...args),
  discover: (args) => nativeDiscover(...args),
});
function currentTransport(): string {
  return process.env.NEXT_PUBLIC_MESSAGE_TRANSPORT_ID ?? nativeId;
}
export function sendMessage(...args:SendArgs):Promise<SendResult> {
  return router.send(currentTransport(),args);
}
export function discoverMessages(...args:DiscoverArgs):Promise<DiscoverResult> {
  return router.discover(currentTransport(),args);
}
