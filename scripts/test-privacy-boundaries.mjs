import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const agentClient = await readFile(new URL('../frontend/lib/agent.ts', import.meta.url), 'utf8');
const rooms = await readFile(new URL('../frontend/app/rooms/page.tsx', import.meta.url), 'utf8');
const agent = await readFile(new URL('../backend/src/agent/groq.ts', import.meta.url), 'utf8');

assert.equal(agentClient.includes('GROQ_API_KEY'), false, 'Groq secret must never be referenced by frontend code');
assert.equal(rooms.includes('secret {room.roomSecret}'), false, 'Room secret must not be rendered in the room list');
assert.equal(/never.*sign.*send/i.test(agent), true, 'Agent system policy must prohibit transaction signing');
assert.equal(agent.includes('viewing keys'), true, 'Agent system policy must prohibit viewing-key access');
console.log('privacy boundary checks: PASS');

const discoverRoute = await readFile(new URL('../backend/src/routes/discover.ts', import.meta.url), 'utf8');
const discoverTypes = await readFile(new URL('../backend/src/types.ts', import.meta.url), 'utf8');
const discoverIndex = await readFile(new URL('../backend/src/indexer/poolEvents.ts', import.meta.url), 'utf8');
const messaging = await readFile(new URL('../frontend/lib/vinss-sdk/messaging.ts', import.meta.url), 'utf8');
const offer = await readFile(new URL('../frontend/lib/vinss-sdk/offer.ts', import.meta.url), 'utf8');

assert.equal(discoverRoute.includes('decryptMatching'), false, 'backend discovery must not decrypt');
assert.equal(discoverRoute.includes('body.channelKeyHex'), false, 'backend discovery must not read channelKeyHex');
assert.match(discoverRoute, /"channelKeyHex" in body/, 'backend must explicitly reject channelKeyHex');
assert.equal(discoverTypes.includes('channelKeyHex'), false, 'DiscoverRequest must not contain channelKeyHex');
assert.equal(/import .*decrypt|decryptMatching|tryDecrypt|subtle\.decrypt/.test(discoverIndex), false, 'indexer must not contain decryption code');
assert.equal(messaging.includes('body: JSON.stringify({ channelKeyHex'), false, 'message discovery must not send channelKeyHex');
assert.equal(offer.includes('body: JSON.stringify({ channelKeyHex'), false, 'offer discovery must not send channelKeyHex');
assert.match(messaging, /decryptPayload/, 'message discovery must decrypt locally');
assert.match(offer, /decryptPayload/, 'offer discovery must decrypt locally');
console.log('ciphertext-only discovery boundary checks: PASS');
