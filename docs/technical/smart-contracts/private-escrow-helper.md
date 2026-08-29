# VinssPrivateEscrowHelper

## Source

```text
contracts/src/private_escrow/
├── private_escrow_commitments.cairo
├── private_escrow_events.cairo
├── private_escrow_interfaces.cairo
├── private_escrow_types.cairo
├── private_escrow_validation.cairo
└── vinss_private_escrow_helper.cairo
```

## Purpose

Store encrypted Rekber coordination actions for discovery without holding ERC-20 principal.

This helper and `VinssEscrowRekber` serve different roles:

```text
VinssPrivateEscrowHelper
  = encrypted coordination

VinssEscrowRekber
  = enforceable custody and settlement
```

## Constructor

```text
privacy_pool: ContractAddress
```

Only the configured Privacy Pool may call `privacy_invoke`.

## Envelope

Version:

```text
2
```

Calldata:

```text
[0] envelope_version
[1] private_escrow_action_locator
[2] sender_tag
[3] recipient_tag
[4] claimed_payload_commitment
[5] payload_chunk_count
[6...] ciphertext_chunks
```

There is no fee/output tail in this helper.

## Commitment

```text
Poseidon(
  'VINSS_PRIVATE_ESCROW_COMMIT_V2',
  envelope_version,
  private_escrow_action_locator,
  sender_tag,
  recipient_tag,
  payload_chunk_count,
  ...ciphertext_chunks
)
```

## Validation and storage

The contract enforces:

```text
configured Privacy Pool caller
supported envelope version
non-zero locator
non-zero routing tags
non-zero commitment
bounded non-empty ciphertext
exact calldata length
exact recomputed commitment
locator uniqueness
payload commitment uniqueness
```

Stored public structure:

```text
envelope_version
private_escrow_action_locator
sender_tag
recipient_tag
payload_commitment
payload_chunk_count
ciphertext chunks
```

## Event

```text
PrivateEscrowActionCommitted
  key: private_escrow_action_locator
  data:
    payload_commitment
    sender_tag
    recipient_tag
```

## Token behavior

`privacy_invoke` returns an empty `OpenNoteDeposit` span. This contract never reserves or releases custody principal.

## Privacy boundary

The helper does not parse or expose plaintext coordination kind, deal terms, stable participant addresses, or a stable public Rekber relationship identifier. Ciphertext and opaque routing metadata are public.
