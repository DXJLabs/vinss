# VINSS Frontend

Next.js dapp for the VINSS private Deal Room. Talks to the five Cairo
helpers in `../contracts/` through the STRK20 Privacy Wallet API — this app
never touches a viewing key, a note, or a proof (see
`../STRK20_INTEGRATION_PLAN.md`).

## Setup

```bash
npm install
cp .env.local.example .env.local
# fill in contract addresses after deploying (see ../contracts/README.md)
npm run dev
```

Requires the [Ready extension](https://strk20.starknet.io/build) with
privacy capability activated, and Sepolia STRK for gas.

## Structure

- `app/` — Home, Rooms (local room bookkeeping + join-by-secret), Deal Room
  (`room/[roomId]`) with Timeline / Offer / Escrow tabs, Wallet
  (`wallet/page.tsx` — balances + shield).
- `components/` — wallet connect, status/visibility badges.
- `lib/starknet/` — wallet connection (`walletClient.ts`) and env-driven
  contract addresses (`constants.ts`).
- `lib/vinss-sdk/` — one module per helper contract:
  - `messaging.ts` → `VinssMessageHelper`
  - `offer.ts` → `VinssOffer` (includes `discoverOfferActions` for the
    Timeline's Refresh button)
  - `escrow.ts` → `VinssPrivateEscrowHelper` + `VinssPrivateEscrowSettlement`
  - `claim.ts` → `VinssClaimEscrow`
  - `envelope.ts` — shared encryption/commitment helpers used by all of the
    above; calldata shapes match the Cairo interfaces field-for-field.
  - `channelKey.ts` — key derivation. See "Channel key" below.

## Channel key: two paths, one active

`deriveChannelKeyFromRoomSecret` (Path 1, **active**) is what the UI uses
today. Both parties in a Deal Room already have to coordinate out-of-band to
agree they're doing a deal at all, so Rooms → "Gabung room yang ada" has the
counterparty enter the Room ID + Room Secret shared with them however they
like (a link, reading it aloud, a QR code) — both browsers then derive the
identical AES key via SHA-256 and can read/write the same encrypted
timeline, including through the backend's `/discover`.

`deriveChannelKeyViaEcdh` (Path 2, **scaffolded, not wired to any UI**) is
the STRK20-native scheme from
[strk20-by-example.org/viewing-keys](https://strk20-by-example.org/viewing-keys):
sender computes `shared = r·K` against the recipient's registered viewing
public key `K`. The math is implemented and verified against starknet.js's
real `ec.starkCurve` API (`getSharedSecret`, `getPublicKey`,
`utils.randomPrivateKey` all exist). What's missing is a confirmed
on-chain/SDK call for "fetch address X's registered viewing public key" —
wire that lookup in, then switch the Deal Room UI from Path 1 to Path 2 and
retire the room-secret flow.

## Known gaps before this is a finished dapp

- `walletClient.ts` and the SDK modules call `strk20InvokeTransaction` and
  `strk20Balances`, names taken from
  `.agents/skills/strk20-privacy-integration/references/wallet-api-route.md`.
  Re-verify the exact TS signatures against the live WalletAccount guide
  before shipping — see the comment at the top of `walletClient.ts`.
- `app/wallet/page.tsx` calls a `shield()` method on the account whose exact
  name/shape is unconfirmed — same caveat.
- Escrow deposit's `custodyCommitment` is currently generated locally and
  never actually shared with the counterparty through the coordination
  timeline before funds move — the UI lets you deposit before the other
  side has agreed to the same custody id. Wire the coordination step (tab
  1) to pass its result into the deposit step (tab 2) before relying on
  this for a real two-party flow.
- No on-chain room index exists by design (see `messaging_types.cairo`).
  Rooms are a local `localStorage` convenience keyed by a shared secret —
  see "Channel key" above.
- None of this has been `npm install`ed or run — see the root README's
  "what's still unverified" note.
