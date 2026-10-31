export type WalletOutcome<T> = {
    kind: "wallet";
    result: T;
} | {
    kind: "wallet_error";
    error: unknown;
};
/** Install rejection handling before waiting for any preparation callback. */
export function observeWalletOutcome<T>(promise: Promise<T>): Promise<WalletOutcome<T>> {
    return promise.then(result => ({ kind: "wallet" as const, result }), error => ({ kind: "wallet_error" as const, error }));
}
export async function waitForWalletPreparation<T>(ready: Promise<void>, outcome: Promise<WalletOutcome<T>>): Promise<void> {
    await Promise.race([ready, outcome.then(value => {
            if (value.kind === "wallet_error")
                throw value.error;
            throw new Error("Wallet action completed without prepared recovery state.");
        })]);
}
