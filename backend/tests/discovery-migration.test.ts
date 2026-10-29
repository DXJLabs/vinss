import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createDiscoverRouter } from '../src/routes/discover.ts';


test('discovery reads both active and historical helpers with ciphertext-only requests', async () => {
  const seen: string[] = [];
  const definitions = [
    {kind:'message', contractAddress:'0x2'},
    {kind:'message', contractAddress:'0x12'},
    {kind:'offer', contractAddress:'0x3'},
  ];
  const store = { async discover(d: {contractAddress:string}) {
    seen.push(d.contractAddress);
    return [{actionLocator:d.contractAddress, blockNumber:d.contractAddress === '0x2' ? 20:10, ciphertextChunks:['0x1'], transactionHash:d.contractAddress}];
  } };
  const app = express(); app.use(express.json()); app.use(createDiscoverRouter(store as never, definitions as never));
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    const port = (server.address() as {port:number}).port;
    const result = await fetch(`http://127.0.0.1:${port}/discover`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'message'})});
    assert.equal(result.status,200);
    assert.deepEqual(seen,['0x2','0x12']);
    assert.equal((await result.json()).length,2);
    const invalid = await fetch(`http://127.0.0.1:${port}/discover`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'message',roomSecret:'never-send'})});
    assert.equal(invalid.status,400);
  } finally { await new Promise<void>(resolve => server.close(()=>resolve())); }
});

test('invalid additional helper kinds fail before starting indexers', async () => {
  Object.assign(process.env, {STARKNET_NETWORK:'sepolia',RPC_URL:'http://localhost:1',DATABASE_URL:'postgresql://localhost/db',PRIVACY_POOL_ADDRESS:'0x1',MESSAGE_HELPER_ADDRESS:'0x2',OFFER_HELPER_ADDRESS:'0x3',PRIVATE_ESCROW_HELPER_ADDRESS:'0x4',ESCROW_REKBER_ADDRESS:'0x5',SETTLEMENT_CERTIFICATE_ADDRESS:'0x6',MESSAGE_HELPER_START_BLOCK:'0',OFFER_HELPER_START_BLOCK:'0',PRIVATE_ESCROW_HELPER_START_BLOCK:'0',ESCROW_REKBER_START_BLOCK:'0',SETTLEMENT_CERTIFICATE_START_BLOCK:'0'});
  const {loadConfig} = await import('../src/config.ts');
  assert.throws(()=>loadConfig({STARKNET_NETWORK:'sepolia',RPC_URL:'http://localhost:1',DATABASE_URL:'postgresql://localhost/db',
    PRIVACY_POOL_ADDRESS:'0x1',MESSAGE_HELPER_ADDRESS:'0x2',OFFER_HELPER_ADDRESS:'0x3',PRIVATE_ESCROW_HELPER_ADDRESS:'0x4',ESCROW_REKBER_ADDRESS:'0x5',SETTLEMENT_CERTIFICATE_ADDRESS:'0x6',
    MESSAGE_HELPER_START_BLOCK:'0',OFFER_HELPER_START_BLOCK:'0',PRIVATE_ESCROW_HELPER_START_BLOCK:'0',ESCROW_REKBER_START_BLOCK:'0',SETTLEMENT_CERTIFICATE_START_BLOCK:'0',
    ADDITIONAL_DISCOVERY_HELPERS:JSON.stringify([{kind:'plaintext',contractAddress:'0x7',startBlock:0}])}), /additional discovery helper/i);
});
