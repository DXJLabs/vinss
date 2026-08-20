# VinssPrivateEscrowHelper

## Source

```text
contracts/src/private_escrow/vinss_private_escrow_helper.cairo
```

Supporting modules:

```text
private_escrow_interfaces.cairo
private_escrow_types.cairo
private_escrow_validation.cairo
private_escrow_events.cairo
private_escrow_commitments.cairo
```

## Objective

Persist encrypted Escrow Rekber **coordination actions** with the same opaque discovery model used by Message and Offer.

This contract does not custody ERC-20 funds.

## Envelope version

```text
2
```

## Executed V2 calldata layout

The executable contract and current Cairo tests use:

```text
[0] envelope_version
[1] private_escrow_action_locator
[2] sender_tag
[3] recipient_tag
[4] claimed_payload_commitment
[5] payload_chunk_count
[6...] ciphertext_chunks
```

## Commitment

```text
Poseidon(
  VINSS_PRIVATE_ESCROW_COMMIT_V2,
  envelope_version,
  private_escrow_action_locator,
  sender_tag,
  recipient_tag,
  payload_chunk_count,
  ...ciphertext_chunks
)
```

## Contract semantics

The helper does not parse the private coordination action kind.

Application-level coordination semantics remain encrypted.

The helper therefore does not publicly expose a stable escrow ID, lifecycle relationship, participant address, asset, or settlement terms.

## Validation

The helper enforces:

- configured Privacy Pool caller;
- envelope version;
- non-zero locator;
- non-zero sender/recipient tags;
- non-zero commitment;
- bounded/non-empty ciphertext;
- exact calldata size;
- recomputed commitment;
- locator uniqueness;
- commitment uniqueness.

## Storage / discovery

Structural record:

```text
envelope_version
private_escrow_action_locator
sender_tag
recipient_tag
payload_commitment
payload_chunk_count
```

Event:

```text
PrivateEscrowActionCommitted
```

Ciphertext chunks are available through guarded getters used by backend discovery.

## No token movement

`privacy_invoke` returns an empty `OpenNoteDeposit` span.

Actual custody and release/refund belong to `VinssEscrowRekber`.

## Current test coverage

Current Cairo tests verify:

- successful V2 record storage;
- routing tags;
- ciphertext retrieval;
- no output deposit;
- non-Pool caller rejection;
- zero sender/recipient rejection;
- invalid commitment rejection;
- locator replay rejection;
- event routing tags.

## Source-comment note

Some comments in the current Private Escrow Cairo source/constants and the leading frontend Escrow source comment still show an older shorter header that omits sender/recipient tags.

The **executable implementation and tests use the six-field V2 header documented above**.

Those comments should be corrected separately to avoid source-level confusion.
