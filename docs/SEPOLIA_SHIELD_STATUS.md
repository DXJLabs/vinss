# VINSS Shield Sepolia — implementation and verification

Base: `DXJLabs/vinss` at `7679bc274e6f884e18b9854d1042088c41aad600`.

**Full Alice → Bob Shield/Chat/Offer/Escrow settlement is NOT verified.** No
transaction, contract deployment, production redeployment or mainnet config
change was performed for this work.

## What the code now does

- `frontend/env.sepolia.example` and `config/sepolia-deployments.json` preserve
  the existing GitHub Actions addresses. Mainnet's profile is retained.
- `/shield` submits the standard Wallet API `deposit` action on Sepolia. It
  waits for a successful receipt, checks the public registration getter and
  requests native balance discovery before displaying a confirmed state.
- All existing Chat/Offer/Invite/Private Escrow/Rekber STRK20 submissions use
  one guard: current wallet chain, RPC chain, selected account, configured
  helper, deployed ABI and helper-to-pool binding. Wallet chain/account are
  checked again immediately before submission. Certificate claims also check
  wallet/RPC network and the certificate-to-Rekber-to-pool binding.
  A mismatched ABI stops submission.
- RPC chain identity is verified before backend initialization and on every
  indexer polling cycle. Backend discovery, encrypted presence, attachments
  and evidence requests carry and validate network/pool headers.
- Sepolia local rooms, pending transactions, participant keys and history are
  isolated from existing mainnet storage. Old unscoped data is not imported
  into Sepolia. New invitation payloads bind network/pool; old unlabelled
  invitations are accepted only on mainnet for compatibility.
- New encrypted application payloads preserve zero bytes and exact byte
  lengths, and authenticate network/pool as AES-GCM additional data. Existing
  intact historical payloads retain their old decoding path. Zero bytes
  already lost in historical ciphertext cannot be reconstructed reliably.
- The unused, incorrect `deriveChannelKeyViaEcdh` scaffold is removed.

The new backend headers require a coordinated frontend/backend release. The
updated frontend intentionally rejects an old backend without the headers.
Mixed client versions cannot decrypt the new packing format; keep this change
in the separate Sepolia test deployment until a coordinated rollout is planned.

## Native STRK20 versus application encryption

Verified primary reference: the official
[StarkWare SDK source](https://github.com/starkware-libs/starknet-privacy/tree/b40bf109c8e5b97d9d6e8ec6db48b16b9d10a106/sdk)
(`0.14.3-rc.8`) and the installed Starknet.js `10.4.0` / Wallet API `0.10.3`
types. Source files inspected include `sdk/src/utils/hashes.ts`,
`sdk/src/utils/encryptions.ts`, `sdk/src/internal/contract-discovery.ts`,
`sdk/src/internal/pool-contract-interface.ts` and `sdk/src/factory.ts`.

The native protocol derives a directional channel key using the sender address
and private viewing key plus recipient address and public viewing key. Fresh
ephemeral ECDH encrypts that channel key and sender address using versioned
Poseidon tags and field addition. The ephemeral shared-secret mask alone is
**not** the channel key. `get_public_key`, `get_num_of_channels`, and
`get_channel_info` are real public pool getters, confirmed in the Sepolia ABI.

VINSS uses the official Wallet API route for pool operations. Registration,
ephemeral keys, native channel setup, proof generation and native note
encryption/decryption remain in the wallet. `nativeShield.ts` does not generate,
request, export, persist or send a private viewing key to VINSS's backend.

That Wallet API exposes balances/prepare/invoke; it does not expose a method
for VINSS to obtain native channel keys or encrypt arbitrary chat payloads with
them. Current Chat/Offer/Private Escrow content therefore still uses VINSS's
P-256 application key agreement and AES-GCM, carried by STRK20 invocations.
**This change does not turn chat encryption into native pool-channel encryption.**
That requirement needs an explicitly designed wallet-side capability, or an
account-controlled SDK integration with a separate key ownership/recovery
design. Replacing an existing wallet viewing key would break its private state
and is not a valid shortcut.

At inspection, the SDK package returned HTTP 404 from the public npm registry. Its official source
was inspected directly; no unofficial SDK or handwritten replacement for the
native cryptographic protocol was added to VINSS.

## Live Sepolia contract evidence

The older `reports/DEPLOYMENTS.md` stops before the current deployments.
The profile now uses the existing successful Actions runs from August 27–28,
plus the unchanged August 18 PrivateEscrowHelper. No deployment was necessary.
Addresses, transaction hashes, run URLs and receipt block numbers are recorded
in [`config/sepolia-deployments.json`](../config/sepolia-deployments.json).

Read-only RPC checks at block **15439294**, 2026-09-22 UTC, passed for all seven
configured contracts. Full class hashes, ABI function lists and bindings are in
[`reports/SEPOLIA_SHIELD_PREFLIGHT.json`](../reports/SEPOLIA_SHIELD_PREFLIGHT.json).

| Existing deployment | Checked result |
| --- | --- |
| MessageHelper, OfferHelper, Invite | Required entry points, Sepolia pool, and shared FeePolicy match |
| PrivateEscrowHelper | V2 routed record ABI and Sepolia pool match |
| EscrowRekber | Current fee entry points, 39-field custody layout, Sepolia pool and revenue FeePolicy match |
| FeePolicy | Room activation, message and offer quotes return positive amounts |
| SettlementCertificate | Required entry points and binding to the configured Sepolia Rekber match |

The Rekber quote for a one-STRK principal also succeeds. Quotes are read again
at transaction preparation; the values in the report are a snapshot, not a
fixed fee. A successful preflight verifies this configuration, not execution
of a proof, native decryption or settlement.

The old ABIs remain in `sepolia-legacy-helper-abis.json` as negative regression
fixtures, so accidentally restoring an obsolete address cannot silently pass
fee/settlement preparation. `sepolia-current-helper-abis.json` contains the
current deployed ABIs used by the application integration tests.

## Remaining setup for the live test

- Set the public `NEXT_PUBLIC_VINSS_TREASURY_ADDRESS` for **Sepolia** and verify
  its viewing public key in the Sepolia pool. No verified treasury recipient
  was present in the repository or the deployment reports. The example leaves
  it empty, so fee-bearing actions stop before submission. Neither the mainnet
  recipient nor the deployment account is assumed to be the treasury.
- Use a separate Sepolia backend/database with the supplied receipt-derived
  start blocks. The frontend and backend must both include the network headers.
- Connect two STRK20-capable Sepolia wallet sessions controlled by Alice and
  Bob, funded with enough test STRK for the live quoted application fees and
  transaction costs. Wallet approvals/proving are required to complete this
  test; these sessions are not available in this execution environment.

No Cairo source or deployment workflow changes are included. Unshield and
multichain remain deferred.

## Verification performed / still required

Local regression tests cover byte packing, AES-GCM tampering and wrong-key
rejection, application encryption, actual Chat/Offer/Private Escrow send and
discovery functions, funding and release action bundles, exact amount
conversion, wallet changes, RPC/backend mismatches, obsolete ABI rejection,
certificate binding and cache isolation.
They use test wallet/RPC doubles and are **not on-chain native proofs**.

- Sepolia Shield regression: **14 passed**.
- Existing frontend deal/escrow/dispute regression: **12 passed**.
- Backend regression: **42 passed**, including three new network checks.
- TypeScript, invite recovery and privacy boundary checks: **passed**.
- Sepolia production build: **passed**, including the new `/shield` route.
- Read-only live Sepolia preflight: **7/7 contracts pass**, fee quotes available.
- Live Alice/Bob native proof, decryption and settlement: **not run**.

Read-only compatibility check:
`node scripts/check-sepolia-shield.mjs reports/SEPOLIA_SHIELD_PREFLIGHT.json`
(`SEPOLIA_RPC_URL` may override the public endpoint). Exit 2 means incompatible
deployments or unavailable fee quotes. Pass the public treasury address via
`NEXT_PUBLIC_VINSS_TREASURY_ADDRESS` to also inspect its pool registration.
Neither exit 0 nor a registered public key proves a live native settlement.

Live completion requires two user-controlled Sepolia wallet sessions:

- Alice and Bob register/shield using their wallets; verify the registered
  public keys and private balance discovery.
- Alice sends Chat; Bob discovers/decrypts it. Bob replies and Alice decrypts.
- Create and accept an Offer; compare exact terms and token base units.
- Coordinate Private Escrow, fund matching current custody, verify accepted
  receipt and on-chain custody, then release through the real authorization flow.
- Bob discovers the resulting private note/balance; verify consumed custody and
  matching settlement receipt. Reconnect both wallets and verify recovery.
- Record all transaction hashes with `SN_SEPOLIA`. No hashes are invented here.

The Wallet API does not attach an app-specified chain ID to the submit request;
guards recheck immediately before submission, while the wallet must maintain
its own network/account binding during its approval/proving flow. This is not a
claim that VINSS can control an external wallet's behavior atomically.

## Deferred scope

- TODO: user-facing **Unshield on Starknet**, after Shield passes the live flow.
  Existing anonymizer-internal `withdraw` actions are part of the current
  protocol and have not been removed.
- TODO: **multichain**, one ecosystem at a time according to competition/grant
  requirements after Starknet Shield is complete.
