# Public Deal Room rail

`VinssPublicRail` is an immutable adapter for ordinary Starknet account calls over **new** instances of existing helpers. Existing Shield deployments, helper source, encrypted envelope schemas, helper discovery events and Rekber economic rules remain unchanged. Public accounts, token amounts, timing and roles are visible; commercial terms and messages must be encrypted before constructing calldata.

## Deployment

1. Declare the adapter, `VinssPublicFeePolicy` and existing helper/Rekber classes.
2. Deploy `VinssPublicFeePolicy(shield_policy)`. Actions1/2/3 return `ceil(shield_quote/2)` (including USD views), action4 is unchanged. `get_shield_policy()` exposes the immutable source. Its pricing setter always reverts.
3. Deploy `VinssPublicRail(initializer_admin,treasury,fee_token)`. Treasury and STRK fee token are immutable; user operations start disabled.
4. Deploy new Invite, MessageHelper and OfferHelper with privacy_pool=adapter, open_note_token=fee_token, fee_policy=public wrapper. Deploy new PrivateEscrowHelper with privacy_pool=adapter. Deploy new Rekber with privacy_pool=adapter, **original Shield revenue policy**, original oracle, supported tokens and unchanged minimum/reserve parameters. Public certificates need a new SettlementCertificate bound to this Rekber.
5. Initializer calls `initialize(invite,message,offer,escrow_action,rekber,fee_policy)`. All helpers must report privacy_pool=adapter; flat helpers must report the wrapper; Rekber's STRK token must equal fee_token and its revenue policy must equal wrapper.get_shield_policy(), distinct from wrapper itself. Initialization erases admin and cannot repeat.
6. Independently attest declared class hashes, flat-helper fee tokens, wrapper source, actual Shield policy identity, original Rekber oracle/resolver/verifier and unchanged economic constructor parameters before publishing addresses. Source/tests do not attest a live deployment.

Publish chain ID, addresses and indexer start blocks together. `get_configuration()` returns `[treasury,fee_token,invite,message,offer,escrow_action,rekber,fee_policy]`; raw RPC return includes the ordinary Span length8. Clients fail closed on mismatch. No deployment or live transaction is included here.

## ABI

All arguments below are typed and snake_case. A Span serializes as length followed by values. Write operations return unit.

| Endpoint | Arguments / result |
| --- | --- |
| `initialize` | `(invite,message,offer,escrow_action,rekber,fee_policy)` each ContractAddress |
| `get_configuration` | `() -> Span<ContractAddress>` in order above |
| `create_invite` | `(calldata:Span<felt252>,claim_public_key:felt252)` |
| `consume_invite` | `(commitment:felt252,signature_r:felt252,signature_s:felt252)` |
| `get_invite` | `(commitment:felt252) -> InviteEntry { expires_at:u64,consumed:bool,exists:bool }` |
| `get_invite_consumer` | `(commitment:felt252) -> ContractAddress` (zero until consumed) |
| `post_message` / `post_offer` | `(calldata:Span<felt252>,locator_nonce:felt252)` |
| `post_escrow_action` | `(calldata:Span<felt252>,quoted_workflow_fee:u128,locator_nonce:felt252)` |
| `fund_custody` | `(calldata:Span<felt252>,payee:ContractAddress)` |
| `act_custody` | `(calldata:Span<felt252>)` |
| `get_custody_parties` | `(commitment:felt252) -> (payer:ContractAddress,payee:ContractAddress)` |

There is no commit/reveal invitation endpoint. Its earlier unreleased design was replaced by the signed capability protocol below.

Account multicalls approve the **adapter** for exact token amounts immediately before operations. Payloads retain existing helper formats, including fee/output-ID tails. Output IDs are opaque accounting identifiers and do not create privacy notes. No arbitrary helper, target, selector, source account or recipient can be supplied.

## Signed invite capability

Generate a random nonzero Stark private key client-side (31 random bytes fit the scalar bounds), keep it inside the encrypted invite payload, and derive its Stark public key x-coordinate. Never include the private key or an invite bearer secret in public calldata.

Compute `commitment = Poseidon(['VINSS_PUBLIC_INVITE_V1',chain_id,adapter,creator_account,claim_public_key])`. Creator calls `create_invite([0,commitment,expires_at,quoted_flat_fee,output_id],claim_public_key)`. The adapter verifies actual caller/chain/adapter binding and a valid nonzero public curve point, then invokes unchanged helper CREATE. Copying a pending CREATE from another wallet fails the creator binding.

The joining account signs `digest = Poseidon(['VINSS_PUBLIC_CONSUME_V1',chain_id,adapter,joining_account,commitment]) mod 2^251` locally using the invite private key, then calls `consume_invite(commitment,r,s)` through its normal authenticated account. The adapter validates helper existence/expiry, unused consumer, `0<r<2^251`, `0<s<StarkCurve.ORDER` and the standard Cairo `core::ecdsa::check_ecdsa_signature`. It atomically records consumer and emits adapter `InviteConsumed { commitment,consumer }`. No low-S restriction is required because replay state is keyed by invite commitment, independent of signature representation.

Copying a signature cannot authorize another caller, adapter or chain, including after arbitrarily delayed inclusion. The unchanged helper's secret-revealing CONSUME is never called, so its consumed flag remains false. **All public invitation status/recovery reads must use adapter.get_invite/get_invite_consumer**, and public consumption monitoring must include the adapter event. A confirmed join belongs to the exact returned consumer.

## Public action locator namespace

For each public encrypted message, offer or escrow coordination action generate a fresh nonzero nonce and derive `locator = Poseidon(['VINSS_PUBLIC_ACTION_V1',chain_id,adapter,caller,nonce])`. Place that value in existing envelope field1 **before** deriving routing/encryption commitments; supply nonce as the separate typed adapter argument. The adapter checks actual caller/chain/adapter binding before transfer or forwarding. Another wallet cannot occupy the same pending locator with altered ciphertext, even if it recomputes a valid helper commitment. Existing ciphertext envelopes, commitment domains and helper validation remain unchanged.

## Fees and custody

Flat invite/message/offer quotes must equal the current public wrapper quote exactly. Funding directly transfers parsed principal+the exact unchanged Rekber quote from caller to configured Rekber, then drains only its validated fee to fixed treasury. Existing surplus cannot substitute for caller funding. Funded payer=caller and distinct nonzero payee become immutable roles for that commitment.

Encrypted coordination quoted workflow revenue must be0 or exactly1STRK paid to treasury. Its semantic action is encrypted, so the adapter cannot prove whether it represents an agreement; the application preserves its existing charge decision.

Rekber actions4/6/10 always charge the existing1STRK workflow fee. Standalone actions5/7 also charge1STRK; when the same caller already posted a successfully paid message in the **same transaction**, actions5/7 charge no additional workflow fee, preserving existing message-bundle behavior. The adapter stores caller's last paid message transaction hash and only exempts equal nonzero hashes. Prior transactions, another caller's message and txhash0 cannot waive it. Other lifecycle actions require no replay dust. Approvals must include applicable STRK workflow revenue, even for USDC principal.

| Rekber action | Caller | Principal recipient |
| --- | --- | --- |
| 2 mutual release,8 timeout release | bound payee | bound payee |
| 3 timeout refund,9 mutual refund | bound payer | bound payer |
| 4 submit fulfillment | bound payee | none |
| 5 confirm,7 request revision | bound payer | none |
| 6 dispute,10 resolution claim | bound party matching role1=payer/2=payee | action10: same party |

All existing capability checks, review/revision windows, original 2%/USD floor/reserve, resolver/verifier authorization, split accounting and replay checks still run. Every output must have the exact expected count/token/amount/ID; helper allowance must equal that amount before drain and zero afterward. Non-output operations must return none. Recipient balances must increase exactly. Reentrancy guard covers funding, helper invocation and collection; failure atomically reverts transfers and state.

The adapter authenticates caller-funded roles; it does not attest commercial payee acceptance. A caller can fund a copied custody commitment using their own money, creating a duplicate-commitment conflict. Client recovery must compare **all** accepted signed setup/custody fields and payer/payee binding before declaring funding success. The attacker cannot spend the victim's allowance because funding always pulls from actual caller.

Frontend public certificate metadata base URI: `/api/public-certificates/`.
This endpoint preserves `rail=unshield` in external/image links; the standard
metadata endpoint defaults to Shield for existing NFT contracts.
