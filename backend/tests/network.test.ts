import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { CHAIN_IDS, networkBoundary, verifyRpcNetwork } from "../src/network.ts";

afterEach(() => mock.restoreAll());

test("RPC verification rejects a valid response from the wrong chain", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ result: CHAIN_IDS.mainnet }));
  await assert.rejects(verifyRpcNetwork({ network: "sepolia", rpcUrl: "https://rpc.invalid" }), /not on Starknet sepolia/);
});

test("RPC verification fails closed on RPC errors", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ error: { code: -32000 } }));
  await assert.rejects(verifyRpcNetwork({ network: "sepolia", rpcUrl: "https://rpc.invalid" }), /did not return/);
});

test("backend rejects crossed network/pool before the discovery handler", () => {
  for (const headers of [
    { "X-VINSS-Network": "mainnet", "X-VINSS-Privacy-Pool": "0x1" },
    { "X-VINSS-Network": "sepolia", "X-VINSS-Privacy-Pool": "0x2" },
  ]) {
    const req = { get: (name: string) => headers[name as keyof typeof headers] } as Request;
    let called = false; let status = 0;
    const res = { setHeader() {}, status(value: number) { status = value; return this; }, json() {} } as unknown as Response;
    networkBoundary({ network: "sepolia", contracts: { privacyPool: "0x1" } as never })(req, res, () => { called = true; });
    assert.equal(status, 409); assert.equal(called, false);
  }
});
