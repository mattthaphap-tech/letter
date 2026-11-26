# The Man Who Sold the Eiffel Tower (Victor Lustig) - YouTube Shorts 1080x1920, 51,9 detik

Video ini ada di `src/videos/lustig/` (demo dan anakpungut tidak diubah). Dikunci ke voiceover EP01 (public/lustig_vo.mp3 / .srt).

## Render
    npm install
    npm run lustig:all        # stills + video + caption  (audio sudah jadi: public/lustig_mix.wav)

Atau per fase (disarankan, sesuai GUIDELINES.md):
    npm run lustig:stills     # CEK DULU: out/lustig/stills
    npm run lustig:previews   # out/lustig/previews
    npm run lustig:audio      # hanya jika mau membuat ulang mix
    npm run lustig:video      # out/lustig/Lustig_Video_Final.mp4
    npm run lustig:captions   # caption transparan + video akhir dengan caption

Pratinjau: `npm run studio` -> folder LustigEiffel -> LustigShortWithCaptions.
Chrome default `C:/Program Files/Google/Chrome/Application/chrome.exe`; ganti lewat env CHROME_PATH.

## Isi
- story.ts   10 shot, 28 sudut kamera, camera kick di punchline, flash di detik 51,3
- build.ts   3 set 3D: plaza Paris 1925 (Menara Eiffel berkarat, gedung Haussmann, mobil dinas), stasiun kereta Vienna Express, sel penjara
- cast.ts    Lustig (topi tinggi, kumis, rompi), Poisson (kacamata, amplop suap), 3 pedagang besi tua, 2 polisi + kartu: ID palsu, kontrak + stempel OFFICIAL, amplop uang, borgol, uang FAKE, badge
- toon.ts    outfit baru + prop envelope (dan prop dari video sebelumnya)
- caption_chunks.json  76 chunk 1-2 kata dari SRT; scripts/*-lustig.*, scripts/gen-audio-lustig.py

## Belum dirender di sini
Three.js dan Remotion tidak bisa dijalankan di lingkungan pembuatnya. Yang sudah dites: type-check (hanya noise stub, sama dengan file bawaan),
logika panggung semua 1558 frame tanpa error, kamera tanpa NaN, gambar karakter dan kartu di Chromium, dan mix audio.
Yang BELUM dilihat: tampilan set 3D dan framing kamera. Jalankan lustig:stills dulu dan koreksi posisi/skala bila perlu.
