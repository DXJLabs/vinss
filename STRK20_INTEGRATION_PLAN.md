# STRK20_INTEGRATION_PLAN.md

# Rencana Integrasi STRK20 untuk VEIL

**Status:** Dokumen pengarahan untuk coding agent  
**Bahasa:** Indonesia  
**Target awal:** Starknet Sepolia  
**Repository:** `DXJLabs/velix`  
**Branch acuan:** `phase4/privacy-pool-prover-poc`  
**Commit acuan:** `4002565`

> Dokumen ini diberikan kepada Codex, Claude Code, Cursor, atau coding agent lain setelah STRK20 Agent Skill dipasang.
>
> Dokumen ini bukan pengganti audit repository. Agent wajib memindai repository aktual, memperbarui nama file dan path berdasarkan kondisi nyata, lalu berhenti sebelum coding.

---

## 1. Tujuan

Mengintegrasikan VEIL dengan stack resmi Starknet Privacy/STRK20 untuk private Deal Room yang mencakup:

- encrypted on-chain messaging;
- offer dan counter-offer;
- accept dan reject;
- private payment memo;
- escrow coordination;
- settlement evidence;
- private transfer melalui stack resmi Starknet Privacy.

VEIL bukan CAREL, ChainEstate, Arbitrum, iExec, Agentic DeFi, Noir, Garaga, messenger umum, atau wallet umum.

---

## 2. Cara Menggunakan

### Pasang Agent Skill

```bash
npx skills add starkience/strk20-agent-skills
```

### Instruksi awal kepada agent

```text
Baca STRK20_INTEGRATION_PLAN.md.

Gunakan STRK20 Agent Skill untuk memindai repository aktual.
Lakukan hanya audit dan perencanaan.
Buat REPOSITORY_AUDIT.md.
Perbarui STRK20_INTEGRATION_PLAN.md menggunakan path file nyata.
Jangan ubah source code.
Jangan instal dependency.
Jangan commit, push, atau deploy.
Jangan mengedit Cairo contracts.
Berhenti dan tunggu persetujuan saya.
```

---

## 3. Sumber Teknis

Urutan sumber:

1. dokumentasi resmi Starknet Privacy;
2. source resmi `starkware-libs/starknet-privacy`;
3. STRK20 by Example;
4. STRK20 Agent Skill;
5. repository VEIL aktual;
6. hasil test lokal dan Sepolia;
7. dokumentasi internal VEIL.

Sumber agent-readable:

```text
https://strk20-by-example.org/llms.txt
https://strk20-by-example.org/llms-full.txt
```

Source:

```text
https://github.com/starkience/strk20-agent-skills
https://github.com/starkware-libs/starknet-privacy
https://docs.starknet.io/build/starknet-privacy/overview
```

---

## 4. Versi yang Dikunci

| Komponen | Versi/aturan |
|---|---|
| Privacy SDK | `@starkware-libs/starknet-privacy-sdk` `0.14.3-rc.2` |
| Tag SDK | `PRIVACY-0.14.3-RC.2` |
| Pool compatibility | `PRIVACY-0.14.3-RC.0` |
| Proof transaction | Invoke Transaction V3 |
| Submission authorization | `OutsideExecutionVersion.V2` |
| Target awal | Starknet Sepolia |
| Mainnet | Memerlukan persetujuan eksplisit |

Agent tidak boleh mengganti versi tanpa compatibility review dan persetujuan.

---

## 5. Kondisi VEIL yang Diketahui

- self-hosted transaction prover pernah bekerja;
- real proof pernah berhasil;
- Private Invoke V3 pernah berhasil;
- current Sepolia Privacy Pool masih legacy/pre-screening;
- Shield deposit harus tetap dinonaktifkan;
- pure shielded chat masih `BLOCKED / UNVERIFIED`;
- real two-party Sepolia E2E belum selesai;
- direct encrypted helper adalah legacy/fallback;
- direct helper bukan arsitektur produksi final;
- frontend tidak boleh memberi label `Shielded` pada jalur legacy;
- symmetric fallback key demo bukan privasi produksi.

---

## 6. Batas Agent Skill

Agent Skill boleh:

- memindai repository;
- menemukan versi `starknet.js`, wallet connector, Cairo contract, backend, SDK, dan prover;
- menemukan titik integrasi;
- memilih jalur integrasi;
- membuat rencana bertahap;
- membantu implementasi setelah disetujui;
- menjalankan pemeriksaan otomatis.

Agent Skill tidak boleh:

- membuat Cairo contract;
- mengedit Cairo contract;
- menyentuh private key, viewing key, seed phrase, atau secret;
- menyimpan key material ke file;
- deploy mainnet tanpa persetujuan;
- menyatakan privasi selesai hanya karena build berhasil.

Contract yang tetap menjadi tanggung jawab tim VEIL:

- `VeilChannelHelper`;
- `VeilOffer`;
- `VeilEscrow`.

Agent boleh membaca dan mengaudit contract, tetapi hanya membuat rekomendasi jika perubahan Cairo dibutuhkan.

---

## 7. Data yang Harus Privat

Target production:

- message;
- attachment metadata sensitif;
- offer;
- counter-offer;
- accept;
- reject;
- offer terms;
- payment memo;
- escrow coordination;
- claim/dispute coordination;
- isi kesepakatan;
- konteks settlement.

Agent wajib menjelaskan:

1. data sebelum enkripsi;
2. data yang disembunyikan Privacy Pool;
3. data yang tetap terlihat;
4. data on-chain;
5. data indexer;
6. data yang hanya tersedia di perangkat pengguna.

---

## 8. Data yang Tidak Boleh Bocor

Dilarang masuk source, commit, log, database plaintext, analytics, atau error report:

- private key;
- seed phrase;
- viewing key;
- shared secret;
- derived encryption key;
- session key;
- plaintext message;
- plaintext offer;
- plaintext payment memo;
- plaintext escrow terms;
- decrypted attachment.

Gunakan placeholder:

```env
STARKNET_RPC_URL=
PRIVACY_PROVER_URL=
PRIVACY_POOL_ADDRESS=
VEIL_CHANNEL_HELPER_ADDRESS=
VEIL_OFFER_ADDRESS=
VEIL_ESCROW_ADDRESS=
```

---

## 9. Batas Privasi

Agent harus membuat bagian `PRIVACY_BOUNDARIES` yang menjelaskan metadata yang mungkin tetap terlihat:

- transaction hash;
- block number;
- timestamp;
- contract interaction;
- encrypted note;
- nullifier;
- commitment;
- event index;
- ciphertext size;
- gas/fee;
- timing pattern;
- metadata protocol.

Jangan gunakan klaim:

- `100% anonymous`;
- `tidak ada metadata`;
- `untraceable`;
- `fully private`;

tanpa bukti teknis dan sumber resmi.

---

## 10. Audit Repository Wajib

Sebelum coding, audit:

### Root

- package manager;
- workspace;
- build/test/lint commands;
- environment;
- CI;
- deployment;
- branch dan commit.

### Frontend

- entry point;
- routing;
- Home;
- Rooms;
- Deal Room;
- Wallet;
- Points;
- Settings;
- wallet connection;
- transaction submission;
- receipt handling;
- offer/payment/escrow UI;
- activity timeline;
- state management;
- encryption/decryption flow.

### SDK

- `packages/veil-sdk`;
- client;
- privacy adapter;
- direct helper transport;
- canonical privacy transport;
- payload codec;
- discovery;
- transaction builder;
- tests.

Nama di atas hanya konteks. Agent wajib memakai path aktual.

### Smart Contract

- `VeilChannelHelper`;
- `VeilOffer`;
- `VeilEscrow`;
- interface;
- event;
- state machine;
- tests;
- deployment scripts;
- address manifest.

### Backend/Indexer

- API;
- event scanner;
- RPC;
- cursor;
- database;
- discovery;
- attachment;
- invitation;
- prover gateway;
- health;
- logging;
- retry;
- reorg handling.

### Wallet

Identifikasi:

- `starknet.js`;
- `get-starknet`;
- Argent;
- Braavos;
- Privy;
- Ready Account;
- StarkZap;
- AVNU Paymaster;
- account version;
- transaction version.

### Prover

Identifikasi:

- Docker image;
- tag;
- JSON-RPC;
- request/response;
- timeout;
- retry;
- log;
- health check.

---

## 11. Format `REPOSITORY_AUDIT.md`

```md
# Repository Audit

## Ringkasan Eksekutif
## Branch dan Commit
## Struktur Folder Aktual
## Build dan Test Commands
## Frontend Reality
## Wallet Reality
## SDK Reality
## Smart Contract Reality
## Backend dan Indexer Reality
## Prover Reality
## Privacy Pool Reality
## Legacy Path
## Canonical STRK20 Path
## Gap terhadap Target
## Risiko
## File yang Perlu Diubah
## File yang Tidak Boleh Diubah Otomatis
## Pertanyaan Terbuka
## Verdict
```

Setiap temuan harus menyebut path file, fungsi/class, bukti, status, risiko, dan rekomendasi. Dilarang menebak path.

---

## 12. Wawancara Setelah Audit

Tanyakan hanya hal yang belum dapat dipastikan:

1. fitur private untuk MVP;
2. apakah target hanya Sepolia;
3. wallet wajib;
4. apakah private payment masuk MVP;
5. apakah escrow execution atau hanya coordination;
6. apakah backend boleh menyimpan ciphertext;
7. apakah attachment masuk fase awal;
8. apakah legacy path tetap dipertahankan;
9. syarat penghapusan legacy path;
10. alamat pool Sepolia yang sudah dikonfirmasi.

---

## 13. Evaluasi Jalur Integrasi

Agent harus mengevaluasi dan menjelaskan pilihan:

### Wallet API melalui starknet.js

Untuk pengguna dengan wallet biasa dan flow wallet-native.

### Privacy SDK Direct

Hanya jika aplikasi/backend secara sah memegang key miliknya sendiri. Jangan memindahkan key pengguna ke backend.

### Helper/Anonymizer Contract + Wallet API

Untuk private invoke ke application contract. Contract ditulis dan diaudit tim, bukan dibuat atau diedit Agent Skill.

### Private Sub-account

Status awal:

```text
TRACKED / HARUS DIVERIFIKASI DENGAN DUKUNGAN RESMI
```

---

## 14. Arsitektur Target

```text
Pengguna A / Pengguna B
        |
        v
Frontend VEIL
- Deal Room
- Offer
- Payment
- Escrow
- Wallet
        |
        v
VEIL SDK
- Payload validation
- Encryption
- Privacy transport
- Discovery
- Receipt tracking
        |
        +----------------> Indexer / Discovery
        |                  - Ciphertext only
        |                  - Cursor
        |                  - Public metadata
        |
        +----------------> Official Transaction Prover
        |                  - Proof generation
        |                  - No permanent key storage
        |
        v
Starknet Privacy Pool / STRK20
        |
        v
VeilChannelHelper / VeilOffer / VeilEscrow
        |
        v
Encrypted events, commitments, receipts, settlement evidence
```

---

## 15. Legacy vs Canonical

Agent harus membuat tabel berdasarkan audit:

| Fungsi | Legacy direct helper | Canonical STRK20 | Status |
|---|---|---|---|
| Message | isi hasil audit | isi hasil audit | isi |
| Offer | isi hasil audit | isi hasil audit | isi |
| Payment memo | isi hasil audit | isi hasil audit | isi |
| Escrow coordination | isi hasil audit | isi hasil audit | isi |
| Discovery | isi hasil audit | isi hasil audit | isi |
| Encryption | isi hasil audit | isi hasil audit | isi |
| Proof | isi hasil audit | isi hasil audit | isi |
| Two-party E2E | isi hasil audit | isi hasil audit | isi |

Aturan:

- jalur legacy tidak boleh diberi label `Shielded`;
- status harus membedakan prepared, proving, submitted, accepted, reverted, dan failed;
- Shield deposit tetap disabled pada current legacy Sepolia pool.

---

## 16. Fase Implementasi

### Fase 0 — Audit Tanpa Perubahan

Output:

- `REPOSITORY_AUDIT.md`;
- pembaruan dokumen ini.

Larangan:

- tidak coding;
- tidak install dependency;
- tidak commit;
- tidak push;
- tidak deploy.

### Fase 1 — Compatibility Matrix

Kunci:

- Privacy SDK;
- prover image;
- pool contract;
- starknet.js;
- wallet connector;
- account version;
- transaction version;
- Outside Execution;
- Cairo;
- Scarb;
- test framework.

Output:

```text
docs/internal/engineering/STRK20_COMPATIBILITY_MATRIX.md
```

### Fase 2 — Privacy Boundary dan Payload

Output:

```text
docs/internal/engineering/VEIL_PRIVACY_BOUNDARIES.md
docs/internal/engineering/VEIL_PAYLOAD_SPEC.md
```

Tindakan yang dimodelkan:

- message;
- offer;
- counter-offer;
- accept;
- reject;
- payment memo;
- escrow coordination;
- settlement evidence.

### Fase 3 — Official Privacy Transport

Tujuan:

- official Privacy SDK dalam satu adapter;
- legacy dan canonical terpisah;
- Invoke V3;
- OutsideExecutionVersion.V2;
- error mapping;
- test headless;
- tidak ada secret pada log.

### Fase 4 — Prover

Tujuan:

- validasi RPC dan image tag;
- health check;
- timeout;
- retry terbatas;
- sanitized logging;
- pengukuran proof duration;
- real proof yang dapat diulang.

### Fase 5 — Private Invoke ke Helper

Tujuan:

- canonical private invoke;
- selector dan calldata benar;
- transaction hash;
- receipt;
- event;
- commitment/ciphertext verification.

Jika contract perlu diubah, buat:

```text
docs/internal/audits/CAIRO_CHANGE_REQUEST.md
```

Jangan mengedit Cairo otomatis.

### Fase 6 — Discovery dan Dekripsi

Tujuan:

- indexer membaca event;
- ciphertext-only storage;
- cursor;
- duplicate/restart/reorg handling;
- dekripsi lokal;
- negative decryption test.

### Fase 7 — Real Two-Party Messaging E2E

Gunakan dua akun dan dua konteks perangkat/browser terpisah.

Dilarang:

- symmetric demo key;
- hardcoded shared secret;
- fallback yang diberi label canonical.

Alur:

1. A mengirim private message.
2. Proof dibuat.
3. Invoke V3 disubmit.
4. Transaction diterima.
5. Indexer menemukan event.
6. B mendekripsi.
7. B membalas.
8. A mendekripsi balasan.
9. Pihak ketiga gagal mendekripsi.

Bukti:

- transaction hash;
- block;
- event index;
- sanitized logs;
- negative test;
- langkah reproduksi.

### Fase 8 — Offer Flow

- create offer;
- counter;
- accept/reject;
- expire;
- convert to escrow jika didukung.

### Fase 9 — Private Payment Memo

Terminologi:

- `Shield`: public balance ke private balance;
- `Private Transfer`: transfer private;
- `Unshield`: private balance ke public wallet.

### Fase 10 — Escrow Coordination

Bedakan:

- coordination;
- execution;
- deposit;
- activation;
- approval;
- release;
- cancel;
- claim/dispute;
- settlement evidence.

### Fase 11 — Frontend

Deal Room action bar:

```text
Upload | Offer | Pay | Escrow | AI
```

Timeline card:

- message;
- offer;
- counter;
- accept;
- reject;
- payment;
- escrow funding;
- approval;
- release;
- settlement;
- proof;
- error.

### Fase 12 — Security Tests

- unauthorized decryption;
- wrong viewing key;
- wrong room;
- replay;
- duplicate event;
- malformed payload;
- oversized payload;
- wrong chain;
- wrong version;
- prover timeout;
- RPC failure;
- wallet rejection;
- revert;
- indexer restart;
- log leakage scan;
- database plaintext scan;
- secret file scan.

### Fase 13 — Dokumentasi dan Evidence

Output minimum:

```text
REPOSITORY_AUDIT.md
STRK20_INTEGRATION_PLAN.md
docs/internal/engineering/STRK20_COMPATIBILITY_MATRIX.md
docs/internal/engineering/VEIL_PRIVACY_BOUNDARIES.md
docs/internal/engineering/VEIL_PAYLOAD_SPEC.md
docs/internal/testing/TWO_PARTY_E2E_PLAN.md
docs/internal/testing/TWO_PARTY_E2E_REPORT.md
docs/internal/audits/CAIRO_CHANGE_REQUEST.md
docs/public/PRIVACY_STATUS.md
```

---

## 17. Aturan Sebelum Mengubah File

Agent wajib menampilkan:

```text
Fase:
Tujuan:
File yang dibaca:
File yang dibuat:
File yang diubah:
Dependency yang ditambah:
Dependency yang dihapus:
Risiko:
Test:
Rollback:
```

Agent harus menunggu persetujuan.

Setelah selesai:

```text
Ringkasan:
File berubah:
Test:
Hasil:
Belum selesai:
Risiko baru:
Commit:
Saran fase berikut:
```

---

## 18. Aturan Git

- jangan commit sebelum test;
- jangan push tanpa persetujuan;
- jangan force push;
- jangan mengubah branch utama;
- jangan menghapus legacy sebelum canonical terbukti;
- gunakan commit kecil per fase.

Contoh:

```text
feat(privacy): add canonical STRK20 transport adapter
test(privacy): add two-party discovery negative tests
docs(privacy): add compatibility matrix
```

---

## 19. Larangan Klaim

Sebelum real two-party Sepolia E2E berhasil, jangan menulis:

- fully shielded;
- production ready;
- no metadata;
- private chat complete;
- canonical integration complete;
- audited;
- mainnet ready.

Gunakan status:

- planned;
- prepared;
- partial;
- blocked;
- unverified;
- locally verified;
- Sepolia verified;
- two-party verified;
- production reviewed.

---

## 20. Kriteria Selesai

Integrasi hanya dianggap selesai jika:

- repository aktual sudah diaudit;
- compatibility matrix dikunci;
- official Privacy SDK digunakan;
- official prover digunakan;
- Invoke V3 digunakan;
- OutsideExecutionVersion.V2 digunakan;
- legacy dan canonical terpisah;
- tidak ada symmetric demo key pada production path;
- tidak ada plaintext pada chain/indexer;
- tidak ada key material pada log/file;
- real two-party Sepolia E2E berhasil;
- negative decryption test berhasil;
- offer flow berhasil;
- private payment memo berhasil;
- escrow coordination berhasil sesuai scope;
- receipt dan evidence tersedia;
- dokumentasi diperbarui;
- security review selesai;
- mainnet disetujui secara eksplisit.

---

## 21. Instruksi Pertama yang Siap Dikirim

```text
Gunakan STRK20 Agent Skill dan baca STRK20_INTEGRATION_PLAN.md.

Lakukan hanya Fase 0:
- audit repository aktual;
- buat REPOSITORY_AUDIT.md;
- perbarui STRK20_INTEGRATION_PLAN.md dengan path file nyata;
- tandai perbedaan antara dokumen dan repository;
- jangan ubah source;
- jangan instal dependency;
- jangan commit;
- jangan push;
- jangan deploy;
- jangan edit Cairo contracts;
- berhenti dan tunggu persetujuan saya.
```

---

## 22. Keputusan yang Dikunci

- VEIL adalah private Deal Room di Starknet.
- STRK20 Agent Skill dipakai untuk audit, rencana, dan bantuan implementasi.
- Agent Skill bukan bagian runtime.
- Agent Skill tidak boleh membuat atau mengedit Cairo contract.
- Direct helper adalah legacy.
- Official Starknet Privacy/STRK20 adalah arah produksi.
- Shield deposit tetap disabled pada current legacy Sepolia pool.
- Real two-party Sepolia E2E adalah syarat verifikasi.
- Mainnet membutuhkan persetujuan eksplisit.
- Semua klaim harus mengikuti evidence.
