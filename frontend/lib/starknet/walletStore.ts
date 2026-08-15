import { createStore } from "@starknet-io/get-starknet-discovery";

export const walletStore = createStore();

export function watchForInjectedWallets(): () => void {
  const rescan = () => walletStore._refreshInjectedWallets();

  const timers = [0, 150, 400, 900, 1800].map((ms) =>
    setTimeout(rescan, ms),
  );

  const onFocus = () => rescan();

  const onVisible = () => {
    if (document.visibilityState === "visible") {
      rescan();
    }
  };

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    timers.forEach(clearTimeout);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
