# A Letter 40 Years Late - YouTube Shorts 1080x1920, 59,5 detik

Video ini ada di `src/videos/letter/` (demo, anakpungut, dan lustig tidak diubah). Dikunci ke voiceover Letter-40-Years-Late (public/letter_vo.mp3 / .srt).

## Render
    npm install
    npm run letter:all        # stills + video + caption  (audio sudah jadi: public/letter_mix.wav)

Per fase (disarankan, sesuai GUIDELINES.md):
    npm run letter:stills     # CEK DULU: out/letter/stills
    npm run letter:previews   # out/letter/previews
    npm run letter:audio      # hanya jika mau membuat ulang mix
    npm run letter:video      # out/letter/Letter_Video_Final.mp4
    npm run letter:captions   # caption transparan + video akhir dengan caption

Pratinjau: `npm run studio` -> folder LetterFortyYears -> LetterShortWithCaptions.
Chrome default `C:/Program Files/Google/Chrome/Application/chrome.exe`; ganti lewat env CHROME_PATH.

## Isi
- story.ts   12 shot, ~30 sudut kamera, gaya emosional (push-in pelan, kick hanya di momen penting, tanpa flash putih)
- build.ts   3 set 3D: rumah nenek (wallpaper, rak buku, jendela bermatahari, meja dapur, kardus pindahan), kebun musim panas 1951 (pagar, pohon apel, bunga liar, lengkung bunga), peron kereta pasukan
- cast.ts    Sarah, Mary muda, Thomas (prajurit), Daniel muda dan tua, putri kecil + kartu: amplop kuning, surat tulisan tangan (garis merah di "not your real father"), foto berbingkai pita hitam, hati, badge
- toon.ts    outfit baru + prop yellowEnv
- caption_chunks.json  79 chunk 1-2 kata dari SRT; scripts/*-letter.*, scripts/gen-audio-letter.py (pad hangat + lonceng lembut, -18,1 LUFS)

## Belum dirender di sini
Three.js dan Remotion tidak bisa dijalankan di lingkungan pembuatnya. Yang sudah dites: type-check (hanya noise stub, sama dengan file bawaan),
logika panggung semua 1784 frame tanpa error, kamera tanpa NaN, gambar karakter dan kartu di Chromium, dan mix audio.
Yang BELUM dilihat: tampilan set 3D dan framing kamera. Jalankan letter:stills dulu dan koreksi posisi/skala bila perlu.
