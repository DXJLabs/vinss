import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePersistedRoomMode } from '../frontend/lib/starknet/roomMode.ts';

test('a saved Shield selection overrides the obsolete Unshield room lock', () => {
  assert.equal(resolvePersistedRoomMode([{id:'r', transactionMode:'shield'}], 'r', 'unshield'), 'shield');
});
test('a saved Unshield selection overrides the obsolete Shield room lock', () => {
  assert.equal(resolvePersistedRoomMode([{id:'r', transactionMode:'unshield'}], 'r', 'shield'), 'unshield');
});

test('reject known Mainnet pool in a Sepolia Shield configuration before requesting a wallet transaction', async () => {
  const { assertShieldPoolNetwork } = await import('../frontend/lib/starknet/shieldNetwork.ts');
  assert.throws(() => assertShieldPoolNetwork('sepolia', '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a'), /Mainnet/);
  assert.doesNotThrow(() => assertShieldPoolNetwork('sepolia', '0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91'));
});
