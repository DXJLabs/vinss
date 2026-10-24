# Full Deal Room transaction modes

VINSS existing is **Shield**, using STRK20. **Unshield** supplies ordinary
Starknet account execution for the same room workflow. Both store encrypted
message/offer envelopes onchain; public execution does not publish plaintext.

| Operation | Shield (default) | Unshield |
| --- | --- | --- |
| Create/join room invite | STRK20 helper | Public adapter + signed invite capability |
| Direct/group message | STRK20 InvokeExternal | account.execute → public adapter → message helper |
| Offer lifecycle | STRK20 InvokeExternal | account.execute → public adapter → offer helper |
| Rekber agreement | Encrypted private helper | Encrypted public-rail helper |
| Fund escrow | Private balance → Rekber | Public balance → real Rekber custody |
| Fulfill/review/revise/dispute | Existing STRK20 lifecycle | Role-bound adapter → same Rekber state machine |
| Release/refund/resolution | Private note output | Public payout to bound payee/payer |

Unshield is **not** STRK20 note withdrawal, and **not** a direct ERC20 payment
substituting for escrow. The superseded `PublicTransferPanel` has been removed.

## Scope and state

The selector is inside Deal Room. Mode is persisted locally and encrypted into
invites. Legacy rooms/invites default to Shield. A room's first attempted onchain
workflow locks its mode, including uncertain wallet callbacks; active deals must
not be silently moved to another deployment. An invite cannot overwrite an
existing room on another rail. Use a fresh room for a different rail once locked.

`accountForMode` creates a scoped account view without changing the connected
wallet or global mode. Every mutation in invitation/messaging/offers/escrow/
settlement uses `invokeVinssActions`. Shield forwards its original action bundle;
Unshield emits typed, allowlisted adapter calls with exact approvals and atomic
allowance revocation. There is no silent fallback. Backend, fee and custody read
paths use the selected deployment; helper-address-keyed fee caches stay separate.

Unshield uses new helper/Rekber instances pinned to a new adapter. Original
Shield helpers and their pool-only authorization stay unchanged. Rekber's
principal, 2% fee, floor and sponsor reserve stay unchanged. Standalone workflow
fees are preserved; bundled message+confirmation/revision preserves its existing
single-message fee behavior. Public room/message/offer quotes use the onchain
public FeePolicy wrapper (half the source Shield quote, rounded up). Read live
quotes; source changes do not modify deployed prices.

## Public metadata and authorization

Wallet addresses, token movements, amounts, timing and payer/payee role bindings
are public. Message and offer plaintext remains client-side and encrypted before
transaction construction. Public one-time locators bind the caller, chain,
adapter and nonce, preventing another wallet from squatting a copied locator.

Public invites encrypt a random, single-invite Stark signing secret in the link.
Creation binds its public key to the creator/adapter/chain commitment; the joiner
signs a consumer-bound digest. The secret never appears in calldata. Consumption
status/recovery reads the adapter, not the cloned legacy invite's consumed bit;
only the recorded consuming wallet can recover success.

Public custody records bind payer and payee. UI recovery verifies these roles
as well as token/principal/deadlines and all accepted immutable commitments before
calling a custody funded. Payer/payee wallet signatures also bind the public
adapter and Rekber deployment. A copied custody may cause conflict using the
attacker's own funds, but must never be treated as the victim's funding success.

## Configuration and deployment

Set all of these from a verified public deployment; missing values disable
Unshield before signing:

```text
NEXT_PUBLIC_UNSHIELD_ADAPTER_ADDRESS
NEXT_PUBLIC_UNSHIELD_FEE_POLICY_ADDRESS
NEXT_PUBLIC_UNSHIELD_INVITE_ADDRESS
NEXT_PUBLIC_UNSHIELD_MESSAGE_HELPER_ADDRESS
NEXT_PUBLIC_UNSHIELD_OFFER_HELPER_ADDRESS
NEXT_PUBLIC_UNSHIELD_ESCROW_HELPER_ADDRESS
NEXT_PUBLIC_UNSHIELD_REKBER_ADDRESS
NEXT_PUBLIC_UNSHIELD_BACKEND_URL
```

`NEXT_PUBLIC_STRK_ADDRESS`, `NEXT_PUBLIC_USDC_ADDRESS`, treasury, network and RPC
must match the deployment. Shield addresses remain configured independently.
An optional `NEXT_PUBLIC_UNSHIELD_CERTIFICATE_ADDRESS` must point to a certificate
instance bound to the public Rekber. Without it, public certificate claiming is
disabled rather than routed to the Shield certificate. Public certificate contracts
use `/api/public-certificates/` as their metadata base URI; frontend share and
metadata links preserve `?rail=unshield` so the certificate/custody read targets
stay on the correct deployment.

Set `PUBLIC_RAIL_ADAPTER_ADDRESS` on the public backend so arbitration validates
the same adapter and preserves public wallet signature fields. See
`public-dispute.md` for consent and deployment binding.

Run a separate deployment of the existing backend with its helper/Rekber env
addresses set to these new public instances, and its own database/indexer state.
Set the frontend public backend URL to that deployment. Its existing checkpoint
identity includes network/kind/contract address. Do not point the public URL at a
Shield-configured discovery service: writes would work but peers would not find
public ciphertext. No room secret or decryption key is sent to discovery.

See `docs/technical/smart-contracts/public-rail.md` for contract deploy order and
`unshield-sepolia-verification.md` for acceptance. Code/tests are not evidence of
live deployment or real wallet success.
