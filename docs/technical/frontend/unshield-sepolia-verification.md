# Full Unshield — Sepolia acceptance

Deploy and verify the public adapter, cloned helpers/Rekber, public FeePolicy
and a public-configured ciphertext discovery backend first. Follow
`../smart-contracts/public-rail.md`; configure `shield-unshield.md` env values.
The app refuses an unconfigured or mismatched public deployment.

1. Create a fresh Deal Room; Shield is the default. Select Unshield inside the
   room before initiating an onchain workflow. Check that no separate public
   payment/transfer form replaces Rekber.
2. Connect two Sepolia wallets with small public test balances. Check wallet,
   frontend and RPC chain IDs agree. A wrong chain must fail before execute.
3. Create a private Chat invite. Inspect the transaction: ordinary account calls,
   public helper funding, encrypted invite link; no STRK20 invoke/withdraw.
4. Join from the other wallet. Verify the public adapter records the exact
   consumer; no invite secret is revealed in calldata. Copying a signature to a
   different wallet must fail. Callback recovery must reject another consumer.
5. Send direct/group messages and offer/counter/accept actions. Both clients must
   discover ciphertext from the public backend and decrypt identical content.
   Calldata/events must not contain readable chat, terms or room keys.
6. Verify both wallet-authorized Rekber approvals bind the public adapter and
   Rekber address. Fund the accepted amount using public tokens. The receipt
   must show real custody funding, exact principal/fee and bound payer/payee.
   A mismatched existing custody must not be called funded by recovery.
7. Exercise fulfillment, confirmation, revision and dispute. Wrong-role callers
   must revert; clocks and remaining rounds follow the existing Rekber rules.
8. Exercise release/refund and resolver-authorized split claims on separate
   small test custodies. Principal may go only to the bound participant; the
   resolver must not receive funds. Verify Transfer events AND custody state.
9. Compare live Shield/public Room/Message/Offer quotes. Keep actual gas separate
   from service revenue and principal. Check Rekber's quote/floor/reserve and
   standalone/bundled workflow fee behavior match Shield economics.
10. Reload/restore the locked room and reopen its encrypted invite. Mode, backend
    and custody read deployment must stay fixed. Then regression-test a separate
    Shield room with the original STRK20 wallet workflow.

A submitted hash, successful account callback or CI run is not proof of any step
above. No live deployment, real Sepolia transaction, main merge or production
release is claimed by source tests. The legacy `verify-sepolia-unshield.mjs`
script verifies a supplied exact ERC20 Transfer receipt only; it cannot certify
this full escrow/messaging workflow.
