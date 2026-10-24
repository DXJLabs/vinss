# VINSS in-room payment modes — corrected 24 October 2026

**Shield** is the original VINSS private STRK20 + Rekber path (default).
**Unshield** is a normal public ERC-20 transfer on Starknet using the wallet
account's `execute` method. It is **not** a STRK20 private-note withdrawal.

These are two payment choices in the **same existing Deal Room**, inside
its payment/Rekber sheet. Home, wallets and standalone pages no longer
advertise separate apps or disconnected Shield/Unshield forms.

| Payment choice | Execution | Funding source | Rekber protection |
| --- | --- | --- | --- |
| Shield · STRK20 | Original EscrowPanel, private STRK20 workflow | Wallet STRK20 flow | Existing Rekber workflow |
| Unshield · Public | account.execute ERC20 transfer | **Public** STRK/USDC wallet balance | **None** |

Existing room messaging and Offers remain encrypted in **either payment
choice**; Unshield does not reveal chat plaintext, create a public Offer
contract, implement public Rekber or withdraw private notes. These would
require separately validated protocol changes, not a UI switch.

Implementation: `frontend/app/room/[roomId]/page.tsx`,
`frontend/components/room/escrow/PublicTransferPanel.tsx` and
`frontend/lib/starknet/publicTransfer.ts`.

Safety: validate recipient/token addresses; decimal units use BigInt;
ERC20 `transfer` receives a u256 amount (low/high); verify wallet and RPC
chain IDs before wallet signature; explicitly acknowledge no escrow;
report transaction hashes as submitted until an accepted successful INVOKE receipt
contains the exact token Transfer from the sending wallet to the recipient for
the requested amount. Both legacy and indexed SNIP-13 events are supported.
The status button reads the receipt without requesting a signature; RPC errors
leave the payment unverified. Actual receipt gas is shown separately from VINSS
fees. Pending payments block another submission, including after closing and
reopening the payment sheet or switching payment modes in the same room page.
Tracking is held in page memory; before reloading or leaving the room, save the
explorer link. Reloading does not recover tracking automatically. Public transfer
adds zero VINSS service fee; the wallet/network gas and principal are
distinct. Existing Shield and Rekber fees are unchanged by this fix.

Fees in `contracts/src/fee_policy/types.cairo` were reduced for
Message/Offer/Room *in source*. Deployed prices need updated FeePolicy
deployment and independent on-chain verification; Rekber floor, 2% and
sponsor reserve remain untouched.

Verification still needed: real wallet on Sepolia, recipient/event receipt
and gas, compatibility of public `WalletAccountV6.execute` on target
wallet, regression testing with a real private Rekber flow. Code/CI tests
do not assert a successful chain transfer or Mainnet deployment.
