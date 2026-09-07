# VINSS Frontend

Next.js client for the VINSS private Deal Room on Starknet.

The frontend is the privacy-sensitive execution layer: it connects the wallet, derives application encryption keys, encrypts private payloads before submission, decrypts discovered ciphertext locally, coordinates the Deal Room lifecycle, and renders Chat, Offer, Rekber, dispute, settlement, and certificate state.

The frontend integrates with the **STRK20 Privacy Pool / Wallet API**, VINSS Cairo contracts, Starknet RPC, and the VINSS backend through the internal Deal Room integration layer under `lib/deal-room/`.

---

## Current frontend scope

- Two-party encrypted Direct Chat.
- Encrypted direct attachments.
- Structured Offer create / counter / accept / reject flow.
- Private Rekber coordination.
- Rekber funding, fulfillment, review, release, refund, and dispute UX.
- Settlement and authorized claim flows.
- Settlement Certificate claim and verification UI.
- Ready / STRK20 wallet integration.
- Client-side encryption and decryption.
- Ciphertext-only normal discovery for Message, Offer, and private Rekber coordination.
- Runtime FeePolicy quoting.
- Optional scoped VINSS Agent assistance.
- Group conversation support in the conversation layer.

Detailed implementation and privacy boundaries live in [`../docs/technical/frontend/README.md`](../docs/technical/frontend/README.md).

---


## Source structure

```text
frontend/
├── app/
│   ├── api/
│   │   ├── certificates/
│   │   │   └── [tokenId]/
│   │   │       ├── image/
│   │   │       │   └── route.ts
│   │   │       └── route.ts
│   │   └── market/
│   │       └── price/
│   │           └── route.ts
│   ├── certificate/
│   │   └── [tokenId]/
│   │       └── page.tsx
│   ├── invite/
│   │   └── [token]/
│   │       └── page.tsx
│   ├── room/
│   │   └── [roomId]/
│   │       └── page.tsx
│   ├── terms/
│   │   └── page.tsx
│   ├── globals.css
│   ├── home-premium.module.css
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── agent/
│   │   └── AgentPanel.tsx
│   ├── home/
│   │   ├── GuidedDeal.tsx
│   │   └── HomeWorkspace.tsx
│   ├── providers/
│   │   └── WalletProvider.tsx
│   ├── room/
│   │   ├── activity/
│   │   │   └── ActivityPanel.tsx
│   │   ├── conversation/
│   │   │   ├── ConversationActions.tsx
│   │   │   ├── ConversationAvatarIcon.tsx
│   │   │   ├── ConversationPanel.tsx
│   │   │   ├── DirectConversationList.tsx
│   │   │   ├── DirectConversationPanel.tsx
│   │   │   ├── EncryptedAttachmentPreview.tsx
│   │   │   ├── GroupConversationList.tsx
│   │   │   ├── GroupConversationPanel.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── OfferCard.tsx
│   │   │   ├── ProofModal.tsx
│   │   │   ├── RekberTimelineNotice.tsx
│   │   │   ├── chatFormat.ts
│   │   │   └── types.ts
│   │   ├── escrow/
│   │   │   ├── DisputeAgentReview.tsx
│   │   │   ├── EscrowPanel.tsx
│   │   │   ├── EscrowPricing.tsx
│   │   │   ├── RekberProtectionPanel.tsx
│   │   │   └── SettlementFeedback.tsx
│   │   ├── invitation/
│   │   │   └── InvitationPanel.tsx
│   │   ├── loyalty/
│   │   │   └── LoyaltyPanel.tsx
│   │   ├── offer/
│   │   │   ├── CounterOfferForm.tsx
│   │   │   └── OfferPanel.tsx
│   │   ├── RoomHeader.tsx
│   │   └── RoomTabs.tsx
│   ├── rooms/
│   │   ├── DealNetwork.tsx
│   │   └── LiveTxFeed.tsx
│   ├── FeeBreakdown.tsx
│   ├── StarkIdentity.tsx
│   ├── StatusBadge.tsx
│   └── WalletConnectButton.tsx
│
├── content/
│   └── legal/
│       └── terms-of-service.md
│
├── hooks/
│   ├── room/
│   │   ├── useDirectConversation.ts
│   │   ├── useDirectPresence.ts
│   │   ├── useDisputeAgentReview.ts
│   │   ├── useGroupConversation.ts
│   │   ├── useRekberProtectionActions.ts
│   │   ├── useRoom.ts
│   │   ├── useRoomAgent.ts
│   │   ├── useRoomConversation.ts
│   │   ├── useRoomEscrow.ts
│   │   ├── useRoomGroups.ts
│   │   ├── useRoomInvitation.ts
│   │   ├── useRoomOffers.ts
│   │   └── useRoomParticipants.ts
│   └── useStarkIdentity.ts
│
├── lib/
│   ├── deal-room/
│   │   ├── directConversationView.ts
│   │   ├── directMessageRouting.ts
│   │   ├── disputeAgent.ts
│   │   ├── escrow.ts
│   │   ├── escrowSettlement.ts
│   │   ├── invitation.ts
│   │   ├── messaging.ts
│   │   ├── offerTemplates.ts
│   │   ├── offers.ts
│   │   ├── rekberAuthorization.ts
│   │   ├── rekberEvidence.ts
│   │   ├── rekberProtection.ts
│   │   ├── rekberSecrets.ts
│   │   ├── rekberView.ts
│   │   ├── settlement.ts
│   │   ├── settlementPlan.ts
│   │   ├── workConfirmation.ts
│   │   └── workEvidenceUi.ts
│   ├── errors/
│   │   └── uiError.ts
│   ├── groups/
│   │   └── localGroups.ts
│   ├── privacy/
│   │   ├── channelKey.ts
│   │   ├── directAttachments.ts
│   │   ├── encryptedChatCache.ts
│   │   ├── envelope.ts
│   │   ├── messageRouting.ts
│   │   ├── participantKeys.ts
│   │   ├── presence.ts
│   │   └── rekberEvidenceChannel.ts
│   ├── starknet/
│   │   ├── constants.ts
│   │   ├── feePolicy.ts
│   │   ├── identity.ts
│   │   ├── walletClient.ts
│   │   └── walletStore.ts
│   ├── utils/
│   │   └── units.ts
│   ├── agent.ts
│   ├── fileDigest.ts
│   └── loyalty.ts
│
├── public/
│   └── vinss-logo.png
│
├── tests/
│   ├── dispute-agent.test.ts
│   ├── escrow-offer-scenarios.test.ts
│   └── rekber-protection.test.ts
│
├── types/
│   └── deal-room.ts
│
├── env.mainnet.example
├── next-env.d.ts
├── next.config.js
├── package-lock.json
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── tsconfig.json
```

The tree above reflects the tracked application source and project files relevant to the frontend.

Local or generated paths are intentionally omitted:

```text
.env.local
.env.prod.check
.env.production.local.bad
.env.vercel.check
.vercel/
.next/
node_modules/
tsconfig.tsbuildinfo
lib/vinss-sdk/.vercel/
```

`app/debug/`, `lib/debug/`, and `lib/vinss-sdk/` are not shown as source modules because the current local tree you provided does not contain tracked application source files inside them.

---

## Source boundaries

```text
app/
    routes and page composition

components/
    user interface and Deal Room presentation

hooks/room/
    Deal Room state and orchestration

lib/deal-room/
    Message, Offer, Rekber, fulfillment, dispute, and settlement integration

lib/privacy/
    encryption, routing, participant keys, presence, and encrypted cache

lib/starknet/
    wallet, identity, network configuration, and FeePolicy integration

types/
    shared Deal Room domain types
```

---

## Run locally

```bash
cd ~/vinss/frontend
npm install
npm run dev
```

Validation:

```bash
npm run typecheck
npm run build
```

Frontend scenario tests:

```bash
npm run test:escrow-scenarios
npm run test:rekber-protection
npm run test:dispute-agent
```

Playwright UI flow tests currently cover:

- room-secret visibility boundaries;
- Offer fee visibility;
- explicit VINSS Agent context-sharing consent.

```bash
npm run test:e2e
```

---

## Mainnet configuration

Use [`env.mainnet.example`](./env.mainnet.example) as the reference for production frontend configuration.

Runtime contract addresses and network-sensitive values are resolved through the Starknet integration layer.

---

## Technical documentation

Detailed frontend architecture, privacy boundaries, encryption, routing, wallet execution, recovery, Offers, Rekber, dispute behavior, configuration, and testing are documented in:

**[`../docs/technical/frontend/README.md`](../docs/technical/frontend/README.md)**

---

## Privacy rule

Private Message plaintext, private Offer terms, pairwise private keys, room secrets, decrypted conversation state, and Rekber private coordination data are client concerns during normal discovery and must not be sent to the VINSS backend as discovery decryption material.
