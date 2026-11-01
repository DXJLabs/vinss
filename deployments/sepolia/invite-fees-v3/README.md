# Sepolia Invite fee v3 activation

Contract staging succeeded in [CI run 41262798611](https://github.com/DXJLabs/vinss/actions/runs/41262798611), source commit `2372d237cd0a0a7495eeba13e11bcc73b4fafb3e`.

| Invite creation, including Regenerate | VINSS service price |
| --- | --- |
| Unshield | $0.01 |
| Shield | $0.02 |

STRK amounts are converted by the on-chain Pragma-backed policy. Wallet/protocol/network fees are separate; these contracts do not alter Ready's quote. Accepting a link does not charge the VINSS creation fee.

`shield-manifest.json` and `public-manifest.json` preserve the verified CI deployment artifacts. The staging script deploys the established contract suite. Only its native Invite and public Invite route are activated by `frontend.env`; all v2 Message, Offer, discovery and funded Rekber pointers are retained byte-for-byte. Other contracts in the staged suite remain unselected in the app. No backend migration is needed.

`verification.json` records independent read-only Sepolia RPC checks at a pinned block: exact USD quotes, the public half-ceiling STRK relation, class hashes, native pool/helper policies, public adapter configuration, unchanged active Message/Offer prices and original Rekber revenue policy.

The new public Invite adapter is `0x2de49d040c7b58e8d5f1a03d1cd5cf0efe1d89b15766dc4b2c7a6c5cbe465c`. Its configuration is pinned in `NEXT_PUBLIC_PUBLIC_INVITE_PROFILE`; existing v2 public invitations still bind and consume against their original adapter. The native override is `0x6d877e59f5e1e95edacdab4aaa6a0a906a75556527a1b9c563c174fe8525fec`; old native links remain readable and consumable against the retained v2 helper.

Publish the frontend from Termux after pulling main:

```bash
cd ~/vinss && git pull --ff-only origin main && node scripts/deploy-sepolia.mjs
```

This script applies this profile as Vercel build/runtime variables without replacing local Mainnet backup files. After publication, `/fees` must show Sepolia and distinct live Invite quotes. A real Ready wallet transaction is a separate acceptance step; CI and read-only quotes do not establish wallet approval or successful live Invite creation/acceptance.
