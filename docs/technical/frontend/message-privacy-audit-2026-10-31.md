# Audit pemisahan plaintext dan ciphertext pesan VINSS

Tanggal: 31 Oktober 2026 (Asia/Makassar). Baseline sumber: `c6ac143b8518ef314848d061ef05d1a960b13749`, branch `feat/strk20-unshield-fees`.

## Kesimpulan

Pada jalur chat normal yang diperiksa, **plaintext isi pesan tidak disertakan bersama ciphertext ke wallet, kontrak, atau `/discover`**. Plaintext dipakai di memori browser, dienkripsi menjadi ciphertext, lalu dikirim sebagai felt chunks. Setelah discovery, browser mendekripsi dan membuat objek lokal berisi isi pesan yang terbaca beserta locator/hash/blok transaksi. Penggabungan untuk tampilan lokal ini bukan pengiriman plaintext ke blockchain.

Kesimpulan ini berlaku pada sumber dan pengujian yang disebutkan di bawah; bukan sertifikasi seluruh aplikasi atau bukti transaksi live dua wallet. Kontrak memvalidasi struktur dan commitment, bukan membuktikan bahwa setiap client telah memakai enkripsi dengan benar.

## Alur dan bukti sumber

| Batas | Data yang lewat | Bukti |
|---|---|---|
| Composer direct → enkripsi | Payload JSON di memori, menggunakan kunci pairwise ECDH/HKDF | `useDirectConversation.ts:766–804`, `participantKeys.ts:401–458` |
| Composer group → enkripsi | Payload group di memori, menggunakan group key | `useGroupConversation.ts:279–299` |
| Enkripsi → wallet | AES-GCM dengan IV acak 12 byte; felt chunks berisi IV dan ciphertext, header/tag/commitment, serta data fee | `envelope.ts:120–141`, `messaging.ts:77–108,130–179` |
| Shield / Unshield | Shield mengirim actions STRK20; Unshield memetakan envelope terenkripsi ke public adapter. Unshield tidak berarti isi pesan menjadi plaintext | `vinssExecution.ts:30–47`, `publicRailCalls.ts`, `vinss_public_rail.cairo:243` |
| Kontrak → indexer | Ciphertext chunks dan metadata publik | `vinss_message_helper.cairo:30–56,166`, `indexer/service.ts:197–219` |
| Browser → `/discover` | Hanya `{kind:"message"}`; route menolak plaintext/kunci dan field tambahan | `messaging.ts:245–248`, `routes/discover.ts:19–34,85–107` |
| Discovery → tampilan | Browser mendekripsi, lalu menggabungkan `message` dengan locator/hash/blok di memori lokal | `messaging.ts:311–339` |
| Lampiran → backend | Byte file dienkripsi sebelum upload; referensi file dimasukkan ke payload pesan terenkripsi | `directAttachments.ts:68–119` |

Lokasi frontend relatif terhadap `frontend/`; backend terhadap `backend/src/`; kontrak terhadap `contracts/src/`.

## Temuan: perlindungan riwayat direct lokal bergantung pada secret room yang tersimpan terbaca

**Risiko sedang pada baseline audit, dengan prasyarat penyerang memperoleh salinan localStorage origin VINSS. Diperbaiki untuk cache direct yang ditulis/dimigrasikan ke v3; lihat [kunci perangkat dan migrasi](./device-history.md). Uraian berikut merekam kondisi baseline sebelum perbaikan.**

- `HomeWorkspace.tsx:43–44` menyimpan objek room termasuk `roomSecret` melalui JSON biasa di `vinss:local-rooms`.
- `useRoom.ts:55–56` menurunkan channel key dari secret tersebut; `channelKey.ts:31–36` menggunakan SHA-256 dengan domain room.
- `useDirectConversation.ts:503–510,580–589` mengenkripsi riwayat direct v2 menggunakan channel key room, bukan private identity key perangkat atau direct key. Pembacaan menggunakan kunci yang sama pada baris 2116–2125.
- `encryptedChatCache.ts` benar-benar mengenkripsi isi cache dengan AES-GCM; body tidak disimpan sebagai JSON plaintext. Namun secret yang cukup untuk membangun kunci dekripsinya berada dalam storage yang sama. Ekspor/akses storage itu dapat membuka riwayat direct lokal tanpa mendapatkan private ECDH key di IndexedDB.
- Secret room **saja tidak membuka ciphertext direct on-chain**: direct send memakai kunci pairwise. Membaca cache juga memerlukan akses ke cache perangkat tersebut. Peserta room lain tidak otomatis memperoleh cache perangkat kita.
- Group secrets juga disimpan melalui JSON biasa pada `groups/localGroups.ts:73–80`, sehingga perlu masuk rancangan perlindungan secret perangkat.

Reproducer pada `frontend/tests/message-privacy-boundary.test.ts` memakai fungsi produksi: cache tidak memperlihatkan marker plaintext; kunci berbeda gagal; kunci yang direkonstruksi dari secret room berhasil membuka cache.

Rekomendasi: pisahkan enkripsi cache dari secret room yang dibagikan, gunakan kunci perangkat yang dikelola secara terpisah, dan rancang migrasi cache lama beserta pemulihan sebelum mengubah format penyimpanan. Jangan menghapus secret/cache atau mengganti kunci sepihak karena berisiko memutus akses riwayat. Ini mitigasi terhadap salinan storage; script berbahaya yang aktif pada origin yang sama tetap dapat mengakses pesan saat aplikasi membukanya.

## Batas klaim privasi

- Plaintext harus ada di memori/DOM ketika pengguna mengetik atau membaca. XSS, extension berbahaya, atau perangkat terkompromi tidak diselesaikan oleh enkripsi on-chain.
- Metadata publik masih ada: locator, tag, commitment, ukuran payload, tx hash, blok, dan fee. Unshield juga memperlihatkan wallet pengirim dan operasi token.
- Chat aktif memakai AES-GCM dan P-256 ECDH/HKDF; **bukan OpenMLS** dan tidak memberikan jaminan ratchet/forward secrecy MLS.
- Prompt yang sengaja dimasukkan ke Agent dikirim ke endpoint Agent (`agent.ts:146–175`); ringkasan timeline chat disanitasi. Alur dispute/evidence dan feedback berbeda dari discovery. Audit chat ini tidak mendukung klaim umum bahwa backend tidak pernah menerima plaintext apa pun.

## Validasi

- 18 hasil tes runtime lulus: 3 tes batas pesan baru, suite public rail beserta 14 subtes. Ini mencakup enkripsi pesan pada public calldata dan dispatch Shield, bukan transaksi live.
- 8 tes codec/transport/wiring lulus, termasuk leading-zero packing dan pemulihan legacy yang diautentikasi.
- 5 tes backend indexer/discovery migration lulus.
- Pemeriksaan privacy boundaries dan TypeScript build frontend lulus.
- Read-only `POST /discover` pada kedua backend Sepolia masing-masing memberikan 20 record. Field respons: `actionLocator`, `blockNumber`, `ciphertextChunks`, `payloadCommitment`, `recipientTag`, `senderTag`, `transactionHash`. Tidak ada field body/message/plaintext/key pada sampel respons. Tidak ada isi ciphertext atau data pesan pengguna disalin ke laporan.
- Tidak melakukan dekripsi pesan live, dump database internal, pengambilan kunci pengguna, atau uji dua wallet/browser. Pengamatan schema endpoint bukan bukti tentang seluruh histori/log atau semua layanan.

## Penghapusan debug

Halaman `/debug/wallet` dan panduan `wallet-debug.md` dihapus dari source. Tes audit ini tidak menambah route/debug UI. Mekanisme dan nominal fee tidak diubah. Penghapusan di situs aktif memerlukan deployment frontend berikutnya; tidak ada deploy kontrak atau Vercel dalam pekerjaan ini.


## Tindak lanjut perbaikan cache direct

Hook direct sekarang memakai `deviceHistory.ts`: cache v3 dienkripsi dengan kunci AES-GCM non-exportable di IndexedDB yang terpisah dari secret room. Migrasi v1/v2 memverifikasi salinan baru sebelum menghapus salinan lama yang berhasil dibaca. Data yang gagal didekripsi tetap disimpan. Error IndexedDB, kuota, atau autentikasi tidak menurunkan penyimpanan ke plaintext/room-key.

Perbaikan ini berlaku saat percakapan dimigrasikan atau ditulis oleh versi frontend baru, bukan pada salinan localStorage yang sudah bocor sebelumnya atau room lama yang belum dibuka. Secret room/group sendiri belum dipindahkan ke penyimpanan terenkripsi perangkat. Tidak ada perubahan kontrak, fee, atau mekanisme enkripsi pesan on-chain.
