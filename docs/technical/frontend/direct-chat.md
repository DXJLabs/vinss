# Two-Party Private Chat

## Status

**Testnet on-chain verified.**

## Objective

Direct Chat provides encrypted two-party communication while keeping plaintext Message content and reusable participant identities out of helper contract state.

## Key files

```text
hooks/room/useDirectConversation.ts
hooks/room/useRoomParticipants.ts
lib/deal-room/messaging.ts
lib/privacy/participantKeys.ts
lib/privacy/messageRouting.ts
lib/privacy/presence.ts
lib/privacy/encryptedChatCache.ts
```

## Send path

```text
pairwise direct key
→ fresh action locator
→ opaque sender/recipient tags
→ encrypt MessagePayload
→ compute payload commitment
→ STRK20 action bundle
→ Message Helper
```

Important submission excerpt:

```ts
const debugActions = [
  {
    type: "withdraw",
    token: CONTRACTS.messageHelperOpenNoteToken,
    amount: "0x6124fee993bc0000",
    recipient: CONTRACTS.messageHelper,
  },
  {
    type: "transfer",
    token: CONTRACTS.messageHelperOpenNoteToken,
    amount: "OPEN",
    recipient: treasuryAddress,
  },
  {
    type: "invoke",
    contract: CONTRACTS.messageHelper,
    calldata: [
      toFelt(calldata.length + 1),
      ...calldata,
      "${openNoteIds[0]}",
    ],
  },
];

await account.strk20InvokeTransaction(debugActions);
```

The current code routes **7 STRK** application revenue per submitted private Message action.

## Discovery path

The browser requests:

```json
{ "kind": "message" }
```

The backend returns candidate encrypted records.

The frontend first checks the opaque recipient routing tag, then decrypts locally.

After decryption it also binds the encrypted sender identity back to the public opaque sender tag.

## Participant discovery

Participant wallet address + messaging public key are exchanged through encrypted presence and/or encrypted room-level message metadata.

Direct Chat consumes that private participant state to derive the pairwise key.

## Local encrypted history

Direct history can be cached locally using AES-GCM.

The cache is a UX/recovery optimization, not an authoritative network history source.

## Mobile wallet recovery

Before wallet handoff, the frontend persists the prepared locator and pending local entry.

If the Ready callback is delayed, VINSS treats the action as pending and attempts discovery reconciliation instead of immediately declaring failure.
