import { createStore } from "@starknet-io/get-starknet-discovery";

export const walletStore = createStore();

export function refreshInjectedWallets(): void {
  if (typeof window === "undefined") return;
  walletStore._refreshInjectedWallets();
}

export function watchForInjectedWallets(): () => void {
  const rescan = () => refreshInjectedWallets();

  // Android extension hosts can inject Ready after React has mounted.
  // Keep scanning during the initial page lifecycle, then stop polling.
  const timers = [0, 150, 400, 900, 1800, 3500, 6000].map((ms) =>
    setTimeout(rescan, ms),
  );

  const polling = window.setInterval(rescan, 1500);
  const stopPolling = window.setTimeout(
    () => window.clearInterval(polling),
    30_000,
  );

  const onFocus = () => rescan();

  const onVisible = () => {
    if (document.visibilityState === "visible") {
      rescan();
    }
  };

  window.addEventListener("focus", onFocus);
  window.addEventListener("pageshow", onFocus);
  window.addEventListener("load", rescan);
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    timers.forEach(clearTimeout);
    window.clearInterval(polling);
    window.clearTimeout(stopPolling);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("pageshow", onFocus);
    window.removeEventListener("load", rescan);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
