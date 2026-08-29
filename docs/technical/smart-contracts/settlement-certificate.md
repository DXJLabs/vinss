# VinssSettlementCertificate

## Source

```text
contracts/src/settlement_certificate/
├── commitments.cairo
├── events.cairo
├── interfaces.cairo
├── types.cairo
└── vinss_settlement_certificate.cairo
```

## Purpose

`VinssSettlementCertificate` issues a public ERC-721-compatible settlement credential to a participant after a clean successful Rekber lifecycle.

The credential is soulbound: it can be minted once to the committed participant and cannot later be transferred or burned.

## Constructor

```text
escrow_rekber: ContractAddress
base_uri: ByteArray
```

`escrow_rekber` must be non-zero.

ERC-721 metadata is initialized as:

```text
name   = VINSS Settlement Certificate
symbol = VINSS-CERT
base URI = constructor base_uri
```

The Rekber address is fixed after deployment.

## Roles

```text
1 = payer
2 = payee
```

Each role has an independent certificate capability committed when Rekber custody is funded.

## Claim commitment

```text
Poseidon(
  'VINSS_CERT_CLAIM',
  custody_commitment,
  role,
  recipient_address,
  secret
)
```

Binding the recipient address prevents another wallet from using the same certificate secret.

## Token ID

```text
Poseidon(
  'VINSS_CERT_TOKEN',
  custody_commitment,
  role
)
```

The token ID is deterministic for one `(custody, role)` pair.

## `claim`

```text
claim(
  custody_commitment,
  role,
  secret
) -> token_id
```

The recipient is always `get_caller_address()`.

Required conditions:

```text
role is payer or payee
caller is non-zero
secret is non-zero
(custody, role) has not already claimed

Rekber custody exists
custody.consumed == true
custody.refunded == false
custody.disputed == false

computed claim commitment
    == payer_certificate_commitment
       or payee_certificate_commitment
```

A refunded settlement cannot mint a clean-success credential.

A dispute-resolved settlement cannot mint one either, even if one side ultimately receives 100% of principal.

## Non-transferability

The contract embeds OpenZeppelin ERC-721 but replaces the empty hook with a custom `before_update`.

The allowed ownership transition is exactly:

```text
current owner == zero address
to != zero address
```

That is the initial mint.

After mint:

```text
transfer_from       -> reverts CERT_NON_TRANSFERABLE
safe_transfer_from  -> reverts CERT_NON_TRANSFERABLE
burn/zero-recipient ownership update -> reverts CERT_NON_TRANSFERABLE
```

This enforcement is on-chain, not a frontend convention.

### ERC-721 approvals

The standard ERC-721 mixin still exposes approval methods for interface compatibility. An approval does not make the certificate transferable because the ownership-update hook still rejects every post-mint transfer.

## Storage

The certificate contract stores:

```text
escrow_rekber

claimed[(custody_commitment, role)]

certificates[token_id] -> {
  token_id
  custody_commitment
  role
  recipient
  settled_at
  issued_at
}

certificate_exists[token_id]
```

## Event

```text
SettlementCertificateIssued {
  token_id
  recipient
  custody_commitment
  role
  settled_at
  issued_at
}
```

Standard ERC-721 mint events are also emitted by the OpenZeppelin component.

## Public identity boundary

Unlike encrypted Deal Room coordination, a claimed certificate is intentionally public.

The token owner/recipient and its linked custody commitment are public credential data. The certificate must therefore not be described as private settlement evidence.

## Deployment compatibility

Non-transferability exists only in bytecode built from the current source containing the `CERT_NON_TRANSFERABLE` hook.

Any older deployment created before that hook was added must be treated as a different contract version and redeployed before claiming SBT behavior.
