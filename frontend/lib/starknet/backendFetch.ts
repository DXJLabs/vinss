import { CONTRACTS, NETWORK } from "./constants";
import { sameFelt } from "./network";

export async function backendFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-VINSS-Network", NETWORK);
  headers.set("X-VINSS-Privacy-Pool", CONTRACTS.privacyPool);
  const response = await fetch(input, { ...init, headers });
  if (response.headers.get("X-VINSS-Network") !== NETWORK ||
      !sameFelt(response.headers.get("X-VINSS-Privacy-Pool") ?? "", CONTRACTS.privacyPool)) {
    throw new Error("VINSS backend does not match this network and privacy pool. Check the selected configuration.");
  }
  return response;
}
