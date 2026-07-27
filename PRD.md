# Product Requirements Document: Serenity Itinerary

## 1. Ringkasan Produk

Serenity Itinerary adalah aplikasi web responsif untuk menyusun rencana perjalanan, acara, outing, study tour, gathering, dan perjalanan dinas. Pengguna cukup mengisi informasi inti seperti asal, tujuan, jumlah peserta, tujuan kegiatan, tanggal atau durasi, anggaran, serta preferensi. AI kemudian menghasilkan paket rencana yang dapat diedit: persiapan, rundown per hari, transportasi, akomodasi, aktivitas, estimasi biaya, checklist, dokumen, risiko, dan penutupan/evaluasi.

Nama kerja: **Serenity Itinerary**  
Platform MVP: **Progressive Web App (desktop dan mobile)**  
Bahasa awal: **Bahasa Indonesia**, dengan fondasi untuk lokalisasi  
AI bawaan: **DeepSeek**, dengan arsitektur multi-provider dan BYOK (Bring Your Own Key)  
Backend: **Firebase Authentication, Firestore, dan Cloud Functions**

## 2. Masalah

Perencanaan perjalanan atau acara saat ini tersebar di chat, spreadsheet, dokumen, dan pencarian web. Pengguna harus mengubah informasi singkat menjadi banyak artefak yang saling berkaitan, sementara perubahan peserta, jadwal, atau biaya sering membuat seluruh rencana tidak sinkron.

Serenity Itinerary mengurangi pekerjaan tersebut menjadi tiga langkah:

1. Isi brief inti.
2. Biarkan AI membuat draft terstruktur.
3. Tinjau, ubah, bagikan, dan ekspor satu sumber rencana yang selalu sinkron.

## 3. Sasaran

- Menghasilkan draft itinerary lengkap dalam maksimal 90 detik setelah brief valid dikirim.
- Membuat hasil AI yang terstruktur dan dapat diedit per bagian, bukan hanya teks panjang.
- Menyatukan itinerary, anggaran, checklist, dokumen, dan risiko dalam satu proyek.
- Memungkinkan pengguna memilih provider/model AI dan memasukkan API key sendiri.
- Menyediakan pengalaman desktop dengan sidebar dan pengalaman mobile dengan bottom navigation.
- Menyimpan data pengguna secara aman di Firebase dan membatasi akses berdasarkan workspace/proyek.

## 4. Bukan Sasaran MVP

- Pemesanan tiket, hotel, atau pembayaran langsung.
- Jaminan harga dan ketersediaan real-time.
- Pelacakan GPS peserta.
- Marketplace vendor.
- Optimasi rute tingkat armada/logistik kompleks.
- Aplikasi native iOS/Android; MVP berupa PWA yang dapat dipasang.

## 5. Target Pengguna

### Persona Utama

- **Personal planner:** merencanakan liburan keluarga atau kelompok kecil.
- **Event organizer:** menyusun gathering, outing, study tour, atau acara komunitas.
- **Admin perusahaan/sekolah:** membutuhkan rundown, pembagian tugas, biaya, dan dokumen yang rapi.
- **Trip leader:** perlu membagikan jadwal dan checklist kepada peserta dari ponsel.

### Jobs To Be Done

- Ketika saya memiliki ide perjalanan, saya ingin mengubah brief sederhana menjadi rencana lengkap agar tidak memulai dari dokumen kosong.
- Ketika detail berubah, saya ingin memperbarui bagian terkait tanpa menulis ulang seluruh rencana.
- Ketika rencana siap, saya ingin membagikan versi yang mudah dibaca dan diekspor.
- Ketika memakai AI, saya ingin memilih provider sendiri dan mengontrol biaya serta API key saya.

## 6. Prinsip Produk

- **AI membuat draft, pengguna memegang keputusan.** Semua hasil diberi status draft sampai disetujui.
- **Terstruktur, bukan chat dump.** Hasil AI wajib mengikuti skema data yang dapat divalidasi.
- **Satu perubahan, satu sumber data.** Timeline, biaya, dan checklist merujuk pada item yang sama jika memungkinkan.
- **Progresif.** Form inti singkat; detail lanjutan bersifat opsional.
- **Jujur terhadap ketidakpastian.** Harga, waktu tempuh, cuaca, dan aturan lokal diberi asumsi serta tanggal verifikasi.

## 7. Ruang Lingkup MVP

### 7.1 Autentikasi dan Onboarding

- Login dengan Google dan email link.
- Membuat profil, zona waktu, mata uang, bahasa, dan preferensi perjalanan.
- Onboarding singkat yang mengarahkan pengguna membuat itinerary pertama.

### 7.2 Dashboard

- Daftar proyek terakhir, draft, rencana mendatang, dan rencana selesai.
- Ringkasan jumlah perjalanan, peserta, estimasi anggaran, dan tugas belum selesai.
- Tombol utama **Buat itinerary**.
- Pencarian dan filter berdasarkan status, tanggal, jenis acara, dan tujuan.

### 7.3 Wizard Brief Inti

Langkah wajib:

1. Jenis rencana: liburan, perjalanan dinas, gathering, study tour, acara komunitas, atau kustom.
2. Asal dan tujuan, termasuk multi-destinasi opsional.
3. Tanggal mulai/selesai atau jumlah hari.
4. Jumlah peserta dan komposisi umum: dewasa, anak, lansia, kebutuhan khusus.
5. Tujuan utama dan gaya perjalanan.
6. Anggaran total/per orang dan mata uang.

Langkah opsional:

- Moda transportasi, kelas akomodasi, minat, tempo kegiatan, kebutuhan konsumsi, pantangan, aksesibilitas, jam kegiatan, titik kumpul, catatan dokumen, dan permintaan khusus.
- Mode **Cepat** untuk enam input inti dan mode **Detail** untuk seluruh opsi.
- Ringkasan brief sebelum generasi serta estimasi penggunaan token/biaya jika provider mendukung.

### 7.4 Generasi AI

- Cloud Function mengambil brief, preferensi, dan konfigurasi provider aktif.
- AI mengembalikan JSON tervalidasi, bukan HTML bebas.
- Generasi dilakukan per fase agar kegagalan satu bagian dapat diulang tanpa mengulang semuanya.
- Fase: kerangka perjalanan, rundown, logistik, anggaran, checklist/dokumen, risiko, dan penutupan.
- UI menampilkan progres generasi dan bagian yang sudah selesai.
- Pengguna dapat **regenerate bagian**, **buat lebih santai/padat/hemat**, atau memberi instruksi revisi.
- Setiap generasi menyimpan versi, model, waktu, dan ringkasan perubahan.

### 7.5 Detail Itinerary

- Header berisi judul, rute, tanggal, peserta, status, total biaya, dan tombol bagikan/ekspor.
- Tab/section: Overview, Rundown, Budget, Checklist, Documents, dan Notes.
- Rundown berupa timeline per hari dengan waktu, lokasi, durasi, transportasi, biaya, PIC, catatan, dan status.
- Drag-and-drop untuk mengurutkan aktivitas; konflik waktu ditandai.
- Item dapat dikunci agar tidak berubah saat regenerasi AI.
- Tampilan mobile memprioritaskan agenda hari ini dan akses offline read-only untuk itinerary yang terakhir dibuka.

### 7.6 Anggaran

- Kategori: transportasi, akomodasi, konsumsi, tiket, vendor, dana darurat, dan lainnya.
- Estimasi per item, jumlah, unit, subtotal, status estimasi/aktual, dan pembayar.
- Ringkasan total, per orang, contingency, serta selisih terhadap batas anggaran.
- Harga dari AI selalu berlabel **estimasi** dan memiliki catatan asumsi.

### 7.7 Checklist dan Dokumen

- Checklist sebelum, saat, dan setelah acara.
- Kategori personal, panitia, transportasi, akomodasi, kesehatan, perlengkapan, dan administrasi.
- PIC, tenggat, prioritas, status, dan relasi ke hari/aktivitas.
- Daftar dokumen yang dibutuhkan, misalnya identitas, tiket, surat izin, visa, voucher, kontak darurat.
- Foto dokumentasi dikompres di browser menjadi WebP maksimal 300 KB lalu disimpan sebagai Base64 pada dokumen Firestore terpisah; metadata dan hak akses berada di Firestore.

### 7.8 Kolaborasi dan Berbagi

- Peran proyek: Owner, Editor, dan Viewer.
- Undangan melalui email atau tautan dengan masa berlaku.
- Komentar per bagian dan aktivitas log dasar.
- Public share bersifat read-only, dapat dinonaktifkan, dan tidak menampilkan catatan privat/API key.

### 7.9 Ekspor

- Print/PDF dengan layout ringkas.
- Ekspor kalender `.ics` untuk rundown.
- Ekspor CSV untuk anggaran dan checklist.
- Tautan share responsif untuk peserta.

### 7.10 Pengaturan AI

- Provider MVP: DeepSeek. Adapter disiapkan untuk OpenAI, Gemini, Anthropic, dan endpoint OpenAI-compatible.
- Pengguna memilih provider, model, base URL untuk provider compatible, dan memasukkan API key.
- Tombol **Uji koneksi** memvalidasi key melalui Cloud Function tanpa memaparkan key ke klien lain.
- API key tidak boleh disimpan plaintext di localStorage, log, analytics, atau dokumen Firestore.
- Implementasi disarankan: enkripsi envelope melalui Google Cloud KMS di Cloud Functions; Firestore hanya menyimpan ciphertext, key version, provider, hint empat karakter terakhir, dan metadata. Alternatif enterprise: Secret Manager per workspace.
- Key hanya didekripsi di server saat request AI. Respons API tidak pernah mengembalikan key.
- Pengguna dapat mengganti, menonaktifkan, dan menghapus key.
- Tampilkan model aktif, batas token, timeout, dan perkiraan biaya bila metadata provider tersedia.

## 8. Navigasi dan UX

### Desktop, lebar >= 1024 px

Sidebar tetap:

- Beranda
- Itinerary
- Kalender
- Template
- Dibagikan
- Pengaturan
- Tombol **Buat baru**
- Profil/workspace di bagian bawah

Area konten memiliki top bar kontekstual untuk pencarian, notifikasi, dan aksi halaman. Detail itinerary menggunakan sub-navigation horizontal atau tabs agar sidebar tetap sederhana.

### Mobile, lebar < 768 px

Bottom navigation tetap:

- Beranda
- Rencana
- Tombol tengah **Buat**
- Kalender
- Akun

Fitur sekunder seperti Template, Dibagikan, dan Pengaturan AI berada di halaman Akun/Menu. Form menjadi wizard satu langkah per layar dengan CTA tetap di bawah. Timeline menggunakan kartu vertikal, bukan tabel.

### State Wajib

- Loading/skeleton, empty, offline, permission denied, AI key invalid, quota/rate limit, generation partial, retry, dan success.
- Draft AI diberi label yang jelas.
- Konfirmasi diperlukan sebelum menghapus proyek, key, file, atau versi.

## 9. Alur Utama

1. Pengguna login dan mengatur profil.
2. Jika belum ada provider aktif, pengguna membuka Pengaturan AI, memilih DeepSeek, memasukkan key, lalu menguji koneksi.
3. Pengguna memilih **Buat itinerary** dan mengisi brief inti.
4. Sistem memvalidasi tanggal, peserta, lokasi, dan anggaran.
5. Pengguna meninjau ringkasan lalu menekan **Buat dengan AI**.
6. Cloud Function melakukan generasi bertahap dan menyimpan setiap bagian tervalidasi.
7. Pengguna membuka detail, mengedit timeline, mengunci item, dan meregenerasi bagian tertentu.
8. Pengguna mengundang editor/viewer, menyelesaikan checklist, lalu membagikan atau mengekspor rencana.
9. Setelah acara selesai, status diubah menjadi selesai dan sistem membuat checklist evaluasi/penutupan.

## 10. Struktur Hasil AI

Setiap hasil minimal memuat:

- Ringkasan tujuan dan asumsi.
- Persiapan dan kebutuhan awal.
- Rundown per hari dari keberangkatan sampai kepulangan/penutupan.
- Alternatif atau fallback untuk aktivitas penting.
- Rekomendasi transportasi dan akomodasi berbasis kriteria, bukan klaim ketersediaan.
- Estimasi anggaran terperinci dan dana cadangan.
- Checklist barang, administrasi, kesehatan, dan tugas panitia.
- Dokumen yang perlu disiapkan.
- Risiko, mitigasi, kontak penting yang perlu diisi, dan catatan aksesibilitas.
- Tahap akhir: checkout, perjalanan pulang, dokumentasi, pertanggungjawaban, dan evaluasi.
- Daftar fakta yang perlu diverifikasi pengguna.

## 11. Arsitektur Teknis

### Frontend

- Rekomendasi: Next.js + TypeScript + Tailwind CSS + PWA.
- Firebase Web SDK untuk Auth dan Firestore realtime.
- React Hook Form + Zod untuk form dan validasi schema.
- Rendering server hanya untuk halaman publik yang aman; dashboard bersifat authenticated client app.

### Firebase/GCP

- **Firebase Auth:** identitas pengguna.
- **Cloud Firestore:** workspace, proyek, itinerary terstruktur, versi, tugas, komentar, dan metadata.
- **Firestore photos:** foto WebP yang sudah dikompres maksimal 300 KB per dokumen terpisah; bukan untuk file asli, video, atau galeri besar.
- **Cloud Functions:** AI gateway, validasi provider, ekspor, undangan, dan background generation.
- **Cloud KMS/Secret Manager:** perlindungan API key BYOK.
- **App Check:** mengurangi penyalahgunaan endpoint klien.
- **Firebase Hosting/App Hosting:** deployment web.

### Lapisan Provider AI

Kontrak internal minimal:

```ts
interface AiProvider {
  testConnection(config: ProviderConfig): Promise<ConnectionResult>;
  generateStructured<T>(request: GenerateRequest, schema: JsonSchema): Promise<T>;
}
```

Adapter menangani format request, endpoint, autentikasi, timeout, retry dengan backoff, rate limit, dan normalisasi error. DeepSeek memakai endpoint resmi yang kompatibel dengan format chat completion. Model dan base URL tidak di-hardcode di UI; opsi dikontrol melalui konfigurasi server yang aman.

### Pipeline Generasi

1. Validasi brief dan izin proyek.
2. Muat provider aktif dan dekripsi key di server.
3. Bentuk prompt versi terkunci dengan konteks minimum yang diperlukan.
4. Minta output terstruktur per bagian.
5. Validasi JSON terhadap schema; lakukan satu repair attempt jika invalid.
6. Simpan bagian dan metadata generasi secara atomik.
7. Kirim progres ke UI melalui dokumen job Firestore.
8. Hapus key dan payload sensitif dari memori/log sesegera mungkin.

## 12. Model Data Firestore Awal

```text
users/{userId}
workspaces/{workspaceId}
workspaces/{workspaceId}/members/{userId}
workspaces/{workspaceId}/aiConnections/{connectionId}
workspaces/{workspaceId}/trips/{tripId}
workspaces/{workspaceId}/trips/{tripId}/days/{dayId}
workspaces/{workspaceId}/trips/{tripId}/activities/{activityId}
workspaces/{workspaceId}/trips/{tripId}/budgetItems/{itemId}
workspaces/{workspaceId}/trips/{tripId}/tasks/{taskId}
workspaces/{workspaceId}/trips/{tripId}/documents/{documentId}
workspaces/{workspaceId}/trips/{tripId}/comments/{commentId}
workspaces/{workspaceId}/trips/{tripId}/versions/{versionId}
workspaces/{workspaceId}/generationJobs/{jobId}
```

Semua dokumen proyek memiliki `workspaceId`, audit timestamps, dan `createdBy`. Security Rules memvalidasi keanggotaan serta peran; jangan hanya mengandalkan filter UI.

## 13. Keamanan dan Privasi

- Prinsip least privilege untuk Firestore Rules dan service account.
- API key dienkripsi server-side dan disensor di UI/log.
- Prompt hanya memuat data yang dibutuhkan; data sensitif peserta tidak dikirim tanpa persetujuan eksplisit.
- Public link memakai token acak, dapat dicabut, dan memiliki expiry opsional.
- Rate limit per pengguna/workspace untuk endpoint AI.
- Audit event untuk perubahan key, undangan, ekspor, dan penghapusan.
- Pengguna dapat menghapus proyek, file, koneksi AI, dan akun.
- Kebijakan retensi generation job dan log ditentukan sebelum produksi.
- Disclaimer bahwa output AI dapat keliru dan detail harga, jadwal, visa, kesehatan, serta keselamatan wajib diverifikasi.

## 14. Kebutuhan Nonfungsional

- Responsif pada 360 px hingga desktop lebar.
- Web Vitals halaman utama authenticated: LCP < 2,5 detik pada koneksi wajar di luar waktu generasi AI.
- Autosave edit <= 1 detik setelah idle dan indikator sinkronisasi terlihat.
- P95 operasi Firestore interaktif < 1 detik pada region target.
- Generation job dapat dilanjutkan/retry per bagian dan idempotent.
- Aksesibilitas WCAG 2.2 AA: kontras, fokus keyboard, label form, target sentuh minimal 44 px.
- Semua waktu disimpan UTC dan ditampilkan berdasarkan zona waktu itinerary.
- Angka uang disimpan sebagai integer unit terkecil ditambah kode mata uang.

## 15. Analitik Produk

Event utama tanpa payload sensitif:

- `onboarding_completed`
- `ai_connection_tested`
- `trip_brief_started`
- `trip_generation_started`
- `trip_generation_completed`
- `trip_generation_failed`
- `section_regenerated`
- `trip_shared`
- `trip_exported`
- `trip_completed`

North-star metric: persentase itinerary yang berhasil dihasilkan lalu memiliki minimal satu tindakan lanjutan bermakna (edit, share, checklist selesai, atau ekspor) dalam 7 hari.

## 16. Kriteria Penerimaan MVP

- Pengguna dapat login dan hanya melihat workspace yang diizinkan.
- Pengguna dapat menyimpan koneksi DeepSeek, menguji koneksi, mengganti model, dan menghapus key tanpa key muncul kembali di respons klien.
- Brief enam input inti dapat disimpan sebagai draft dan dilanjutkan.
- Sistem menghasilkan seluruh bagian itinerary dalam struktur yang valid atau menandai bagian gagal untuk retry.
- Pengguna dapat mengedit, mengurutkan, mengunci, dan meregenerasi bagian tanpa menimpa item terkunci.
- Total anggaran dan biaya per orang dihitung dari budget item, bukan angka teks AI.
- Pengguna dapat mengelola checklist, PIC, dan tenggat.
- Viewer public dapat membaca rencana yang dibagikan tetapi tidak dapat melihat catatan privat atau mengedit.
- PDF/print, ICS, dan CSV dapat diekspor.
- Desktop menggunakan sidebar; mobile menggunakan bottom navigation dan tidak mengalami horizontal overflow.
- Firestore Rules memiliki emulator tests untuk Owner, Editor, Viewer, non-member, dan public token.

## 17. Tahapan Rilis

### Fase 1: Fondasi

- Auth, workspace, dashboard, navigation responsive, design system, dan Firebase Rules.

### Fase 2: Core Planner

- Wizard brief, detail itinerary, timeline editor, budget, dan checklist.

### Fase 3: AI

- DeepSeek adapter, BYOK terenkripsi, structured generation, progress, versioning, dan section regenerate.

### Fase 4: Distribusi

- Collaboration, public share, PDF/print, ICS, CSV, offline read-only, dan hardening.

## 18. Grill Me: Keputusan yang Harus Diuji

Bagian ini memaksa keputusan produk sebelum scope berkembang. Default sementara dicantumkan agar pembangunan tetap dapat berjalan.

| Pertanyaan keras | Default MVP | Dampak bila berubah |
|---|---|---|
| Apakah produk fokus perjalanan personal atau acara kelompok? | Mendukung keduanya, tetapi UX dioptimalkan untuk kelompok 2-50 orang. | Kelompok besar membutuhkan roster, approval, dan logistik lanjutan. |
| Apakah satu user memiliki banyak workspace? | Ya, satu personal workspace otomatis; organisasi opsional. | Menambah kompleksitas billing dan membership. |
| Siapa yang membayar token AI? | Pengguna melalui BYOK. | Key platform membutuhkan billing, kuota, fraud prevention, dan margin. |
| Apakah data peserta individual disimpan? | Tidak pada MVP; hanya jumlah dan komposisi. | Data identitas meningkatkan risiko privasi dan kebutuhan consent. |
| Apakah AI boleh mengubah item yang diedit manusia? | Tidak jika item dikunci; regenerasi menampilkan diff. | Tanpa aturan ini pengguna kehilangan kepercayaan. |
| Apakah rekomendasi harus real-time? | Tidak; semua harga/ketersediaan berlabel estimasi. | Real-time membutuhkan travel/location APIs dan biaya tambahan. |
| Apakah offline wajib penuh? | Read-only untuk itinerary terakhir dibuka. | Offline edit membutuhkan conflict resolution dan queue sinkronisasi. |
| Apakah public link boleh terindeks mesin pencari? | Tidak, `noindex`, tokenized, revocable. | Link publik permanen meningkatkan risiko kebocoran. |
| Apakah kolaborator wajib punya akun? | Editor wajib login; viewer dapat memakai public link. | Guest editing memperumit audit dan keamanan. |
| Apa definisi itinerary selesai? | Semua hari tersedia, budget terhitung, dan tidak ada generation section gagal. | Definisi lemah membuat metrik completion menyesatkan. |
| Apa yang terjadi jika key invalid saat job berjalan? | Job berhenti per bagian, data parsial tetap aman, pengguna diminta memperbaiki key lalu retry. | Retry seluruh job membuang biaya dan dapat menimpa edit. |
| Apakah aplikasi memberi saran medis/visa sebagai kepastian? | Tidak; hanya checklist dan tautan/verifikasi yang perlu dilakukan. | Klaim preskriptif menimbulkan risiko keselamatan dan hukum. |

## 19. Pertanyaan untuk Validasi Pemilik Produk

Pertanyaan ini tidak memblokir prototype, tetapi wajib dijawab sebelum implementasi produksi:

1. Pengguna pertama yang paling ingin dilayani: keluarga, EO, sekolah, komunitas, atau perusahaan?
2. Apakah aplikasi hanya Bahasa Indonesia dan destinasi Indonesia pada rilis awal?
3. Apakah target peserta dapat melebihi 50 orang?
4. Apakah perlu data nama peserta, pembagian kamar/kendaraan, dan absensi?
5. Apakah kolaborasi realtime wajib di MVP atau cukup share read-only?
6. Provider selain DeepSeek mana yang harus benar-benar tersedia saat rilis pertama?
7. Apakah API key harus per pengguna atau dapat dipakai bersama satu workspace?
8. Apakah pengguna membutuhkan template khusus seperti study tour, gathering kantor, wedding trip, atau perjalanan dinas?
9. Ekspor mana yang paling kritis: PDF, Excel, WhatsApp-friendly, atau kalender?
10. Apakah monetisasi berupa langganan aplikasi, biaya per itinerary, atau gratis karena pengguna membawa key sendiri?

## 20. Risiko Utama

- **Halusinasi AI:** mitigasi dengan structured output, label asumsi, daftar verifikasi, schema validation, dan human approval.
- **Kebocoran API key:** mitigasi dengan server-only processing, KMS/Secret Manager, redaction, App Check, dan audit.
- **Scope terlalu luas:** batasi MVP pada planning dan sharing, bukan booking atau live tracking.
- **Biaya/latency AI:** generasi per bagian, token budget, retry terbatas, caching konteks, dan BYOK.
- **Data tidak sinkron:** gunakan entity terstruktur dan kalkulasi deterministik untuk waktu/biaya.
- **UI mobile terlalu padat:** timeline kartu, progressive disclosure, sticky CTA, dan bottom navigation lima item.

## 21. Definition of Done

- Seluruh acceptance criteria lulus di staging.
- Unit test untuk kalkulasi budget, tanggal, dan schema transform.
- Integration test Cloud Functions untuk success, invalid key, timeout, invalid JSON, rate limit, dan partial retry.
- Firebase emulator security tests lulus.
- Uji responsif desktop/mobile, keyboard navigation, screen reader labels, dan empty/error states.
- Threat model BYOK ditinjau dan tidak ada secret pada log, analytics, bundle, atau Firestore plaintext.
- Dokumentasi setup Firebase, KMS, DeepSeek, environment variables, deployment, backup, dan incident response tersedia.
