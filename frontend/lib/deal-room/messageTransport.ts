/**
 * Fail-closed multichain encrypted-message delivery registry.
 * Registration does not create a bridge or deploy a contract.
 */
export type MessageChainFamily = "starknet" | "canton" | "evm";
export type MessageTransportRail = "strk20" | "daml" | "contract";
export function makeMessageTransportId(
  family: MessageChainFamily,
  chain: string,
  rail: MessageTransportRail,
): string {
  if (!["starknet","canton","evm"].includes(family) ||
      !["strk20","daml","contract"].includes(rail) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(chain)) throw new Error("Invalid message transport identity.");
  if ((family === "starknet" && rail !== "strk20") ||
      (family === "canton" && rail !== "daml") ||
      (family === "evm" && rail !== "contract")) throw new Error("Invalid chain transport rail.");
  return family + ":" + chain.toLowerCase() + ":" + rail;
}
export interface MessageTransport<S, R, D, V> {
  readonly id: string;
  send(input: S): Promise<R>;
  discover(input: D): Promise<V>;
}
export class MessageTransportRouter<S=unknown,R=unknown,D=unknown,V=unknown> {
  private readonly transports = new Map<string, MessageTransport<S,R,D,V>>();
  register(t: MessageTransport<S,R,D,V>): void {
    if (typeof t.id !== "string" || !/^(starknet|canton|evm):[a-z0-9][a-z0-9_-]{1,63}:(strk20|daml|contract)$/.test(t.id)) {
      throw new Error("Invalid message transport identity.");
    }
    const [family,chain,rail] = t.id.split(":");
    if (makeMessageTransportId(family as MessageChainFamily,chain!,rail as MessageTransportRail)!==t.id)
      throw new Error("Invalid canonical message transport identity.");
    if (this.transports.has(t.id)) throw new Error("Message transport already registered.");
    this.transports.set(t.id,t);
  }
  supportedTransports(): string[] { return [...this.transports.keys()]; }
  private get(id:string):MessageTransport<S,R,D,V> {
    const t=this.transports.get(id);
    if(!t)throw new Error("Message transport not configured: "+id);
    return t;
  }
  async send(id:string,input:S):Promise<R> { return this.get(id).send(input); }
  async discover(id:string,input?:D):Promise<V> { return this.get(id).discover(input as D); }
}
