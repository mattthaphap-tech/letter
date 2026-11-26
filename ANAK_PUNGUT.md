# Anak Pungut Sultan - cara render (YouTube Shorts 1080x1920, 52,3 detik)

Video ini ditambahkan ke repo sebagai folder baru `src/videos/anakpungut/` (demo asli tidak diubah).

## Render (3 fase, sesuai GUIDELINES.md)
    npm install
    npm run anak:stills      # FASE 1: 5 hero stills -> out/anakpungut/stills  (CEK DULU di sini)
    npm run anak:previews    # FASE 2: 5 klip preview -> out/anakpungut/previews
    npm run anak:audio       # FASE 3a: mix suara + SFX (sudah ada public/anakpungut_mix.wav; jalankan hanya kalau mau ubah)
    npm run anak:video       # FASE 3b: out/anakpungut/Anak_Video_Final.mp4
    npm run anak:captions    # FASE 3c: caption transparan + hasil akhir dengan caption

Satu perintah (stills + video + caption, audio sudah jadi): `npm run anak:all`

Pratinjau interaktif: `npm run studio` lalu pilih folder AnakPungut > AnakShortWithCaptions.
Chrome di script default `C:/Program Files/Google/Chrome/Application/chrome.exe`; ganti lewat variabel lingkungan CHROME_PATH.

## Isi
- src/videos/anakpungut/story.ts   10 shot, ~30 sudut kamera, kick, flash (dikunci ke suara)
- src/videos/anakpungut/build.ts   set 3D: kos malam (kasur, meja+lampu, jendela neon, kardus) dan Elon Estate (gerbang, mansion)
- src/videos/anakpungut/cast.ts    Mark, Elon, kartu foto, thought bubble, badge, panggung per shot
- src/videos/anakpungut/toon.ts    outfit baru + prop baru (bowl, photo, capHold, cheer, salute, reach)
- public/anakpungut_vo.mp3 / .srt / anakpungut_mix.wav ; caption_chunks.json (57 chunk 1-2 kata)
- scripts/*-anak.mjs, scripts/gen-audio-anak.py

## Belum pernah dirender di sini
Kode dibuat tanpa bisa menjalankan Three.js/Remotion. Yang sudah dites: type-check, semua 1569 frame logika panggung tanpa error,
kamera tanpa NaN, gambar karakter/prop/kartu di Chromium, dan mix audio. Yang BELUM dilihat: tampilan 3D set dan framing kamera.
Jadi jalankan `npm run anak:stills` dulu dan perbaiki posisi/skala sebelum render penuh.
