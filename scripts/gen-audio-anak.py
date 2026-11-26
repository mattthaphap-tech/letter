#!/usr/bin/env python3
"""
Procedural SFX + Voiceover Master Mix Generator for:
"Anak Pungut Sultan" (1569 frames @ 30 fps = 52.300 s, YouTube Shorts).

Same pipeline as gen-audio.py (reference DSP modules in `skill/templates/audio/`), but locked to
src/videos/anakpungut/story.ts:
  - voice stem: public/anakpungut_vo.mp3
  - frame-accurate SFX: whooshes on cuts, impact kicks on punchlines, photo-fall chime, record scratch on the twist,
    ka-ching + white flash at FLASH_AT = 1560
  - master BS.1770-4 loudness normalisation to -15.0 LUFS, true-peak limited
Outputs `public/anakpungut_mix.wav`.
"""
import os
import sys
import subprocess
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_TPL = os.path.join(ROOT, "skill", "templates", "audio")
sys.path.insert(0, AUDIO_TPL)

from dsp import (
    SR, TAU, ns, tt, rng, dbg, lp, hp, bp, peq, shelf, reson,
    colored, smooth_noise, ramp, fades, phase, modal, pan, st, place, widen,
    make_ir, convolve_st, integrated, momentary_max, true_peak, read_wav, write_wav,
)
import sfx_gen as G
import instruments as I

FPS = 30.0
TOTAL_FRAMES = 1569
DUR = TOTAL_FRAMES / FPS  # 52.300 s
N = ns(DUR)
TARGET_LUFS = -15.0
CEIL_DBTP = -1.2
SFX_DB = -5.5

def fr(f):
    return float(f) / FPS

# ---------------------------------------------------------------- 1. Load Voiceover
def load_voice():
    mp3_path = os.path.join(ROOT, "public", "anakpungut_vo.mp3")
    tmp_wav = os.path.join(ROOT, "public", "_anakpungut_voice_48k.wav")
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", mp3_path, "-ar", str(SR), "-ac", "2", tmp_wav],
        check=True,
    )
    x, sr = read_wav(tmp_wav)
    try:
        os.remove(tmp_wav)
    except OSError:
        pass
    out = np.zeros((2, N))
    m = min(N, x.shape[1])
    out[:, :m] = x[:, :m]
    return out

# ---------------------------------------------------------------- 2. Procedural SFX Generators
RNG = np.random.default_rng(42)

def sfx_whoosh(dur=0.38, center_freq=650, pan_pos=0.0):
    n = ns(dur)
    t = tt(dur)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    noise = colored(n, RNG, -2.5)
    lo = max(60, center_freq * 0.5)
    hi = min(SR * 0.45, center_freq * 1.8)
    w = bp(noise, lo, hi) * env
    return pan(w, pan_pos)

def sfx_kick(dur=0.32, f0=120, f1=38):
    n = ns(dur)
    t = tt(dur)
    env = np.exp(-t * 14.0)
    f_inst = f1 + (f0 - f1) * np.exp(-t * 28.0)
    phi = 2 * np.pi * np.cumsum(f_inst) / SR
    sine = np.sin(phi) * env
    click = np.exp(-t * 180.0) * colored(n, RNG, 2.0)
    hit = sine * 0.85 + click * 0.25
    return st(hit)

def sfx_flash(dur=0.95):
    t = tt(dur)
    out = np.zeros(len(t))
    rise_dur = 0.45
    n_rise = int(rise_dur * SR)
    t_rise = t[:n_rise]
    rise_env = (t_rise / rise_dur) ** 3
    noise_rise = colored(n_rise, RNG, -2.0)
    rise_noise = bp(noise_rise, 350, 2200) * rise_env
    out[:n_rise] += rise_noise * 0.7
    
    n_tail = len(t) - n_rise
    t_tail = np.linspace(0, n_tail / SR, n_tail, endpoint=False)
    tail_env = np.exp(-t_tail * 4.5)
    sub = np.sin(2 * np.pi * (55 * np.exp(-t_tail * 8.0)) * t_tail) * tail_env * 0.9
    sparkle = lp(colored(n_tail, RNG, 1.0), 4500) * tail_env * 0.2
    out[n_rise:] += sub + sparkle
    return st(out)

def sfx_gavel(dur=0.45):
    n = ns(dur)
    t = tt(dur)
    crack = np.exp(-t * 120.0) * colored(n, RNG, 4.0)
    res = (np.sin(2 * np.pi * 380 * t) * 0.5 + np.sin(2 * np.pi * 820 * t) * 0.3) * np.exp(-t * 22.0)
    thud = np.sin(2 * np.pi * 95 * t) * np.exp(-t * 18.0) * 0.7
    return pan(crack * 0.4 + res * 0.4 + thud * 0.6, 0.25)

def sfx_bell(dur=1.2, f_bell=1180):
    n = ns(dur)
    t = tt(dur)
    strike = np.exp(-t * 140.0) * colored(n, RNG, 5.0) * 0.3
    m1 = np.sin(2 * np.pi * f_bell * t) * np.exp(-t * 3.2)
    m2 = np.sin(2 * np.pi * (f_bell * 1.58) * t) * np.exp(-t * 4.5) * 0.45
    m3 = np.sin(2 * np.pi * (f_bell * 2.32) * t) * np.exp(-t * 6.0) * 0.25
    return pan(strike + (m1 + m2 + m3) * 0.65, -0.3)

def sfx_clink(dur=0.6, f0=2200):
    n = ns(dur)
    t = tt(dur)
    body = (np.sin(2 * np.pi * f0 * t) * 0.6 + np.sin(2 * np.pi * (f0 * 1.76) * t) * 0.4) * np.exp(-t * 12.0)
    click = np.exp(-t * 200.0) * colored(n, RNG, 6.0) * 0.25
    return st(body + click)

def sfx_cyber_beep(dur=0.35, f=1480):
    t = tt(dur)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    tone = np.sin(2 * np.pi * f * t) * env
    chirp = np.sin(2 * np.pi * (f * 1.4) * t) * (env ** 2) * 0.3
    return pan(tone + chirp, 0.2)

def sfx_kaching(dur=0.85):
    n = ns(dur)
    t = tt(dur)
    mech = np.exp(-t * 80.0) * colored(n, RNG, 2.0) * 0.5
    bell1 = np.sin(2 * np.pi * 1760 * t) * np.exp(-t * 6.5) * 0.5
    bell2 = np.sin(2 * np.pi * 2640 * t) * np.exp(-t * 8.5) * 0.4
    coins = lp(colored(n, RNG, 4.0), 5500) * np.exp(-t * 9.0) * 0.3
    return pan(mech + bell1 + bell2 + coins, -0.2)

def sfx_scratch(dur=0.55):
    """DJ record scratch: falling-pitch sawtooth + noise (the 'twist' sting)."""
    n = ns(dur)
    t = tt(dur)
    f_inst = 1500 * np.exp(-t * 4.0) + 180
    saw = 2 * ((np.cumsum(f_inst) / SR) % 1.0) - 1
    noise = bp(colored(n, RNG, 0.0), 700, 5200)
    env = np.minimum(t / 0.01, 1.0) * np.exp(-t * 3.2)
    return pan((saw * 0.35 + noise * 0.55) * env, 0.0)

# ---------------------------------------------------------------- 3. Assemble Procedural Track
def generate_sfx():
    sfx = np.zeros((2, N))
    
    def put(start_sec, mono_or_st_wave, gain_db=0.0):
        if mono_or_st_wave.ndim == 1:
            w = st(mono_or_st_wave)
        else:
            w = mono_or_st_wave
        w = w * (10 ** (gain_db / 20.0))
        i0 = ns(start_sec)
        i1 = min(N, i0 + w.shape[1])
        L = i1 - i0
        if L > 0:
            sfx[:, i0:i1] += w[:, :L]

    # --- Shot 1 (0.0 s): quiet room + Mark's sigh
    put(fr(0), sfx_kick(0.45, 70, 36), -9.0)
    put(fr(174), sfx_kick(0.30, 130, 40), -4.0)     # REJECTED stamp slams (5.8 s)
    put(fr(174), sfx_whoosh(0.28, 900, pan_pos=0.3), -7.0)  # hard cut to macro
    put(fr(215), sfx_whoosh(0.32, 650, pan_pos=-0.2), -7.0)

    # --- Shot 2: noodles
    put(fr(255), sfx_whoosh(0.34, 700, pan_pos=-0.2), -7.0)
    put(fr(288), sfx_clink(0.5, 2000), -10.0)       # "$2" coins (9.6 s)
    put(fr(340), sfx_whoosh(0.28, 950, pan_pos=0.3), -7.0)
    put(fr(385), sfx_whoosh(0.32, 600, pan_pos=-0.2), -8.0)

    # --- Shot 3: digging in the box, photo falls
    put(fr(438), sfx_kick(0.32, 110, 40), -5.0)     # cut (14.6 s)
    put(fr(438), sfx_whoosh(0.34, 650, pan_pos=-0.3), -7.0)
    put(fr(490), sfx_whoosh(0.30, 850, pan_pos=0.3), -7.0)
    put(fr(516), sfx_cyber_beep(0.4, 1100), -13.0)  # glow from the box (17.2 s)
    put(fr(531), sfx_kick(0.36, 120, 38), -4.0)     # photo pops out (17.7 s)
    put(fr(549), sfx_bell(0.9, 1500), -9.0)         # photo lands (18.3 s)

    # --- Shot 4: the photo
    put(fr(585), sfx_whoosh(0.34, 750, pan_pos=0.0), -6.5)
    put(fr(606), sfx_clink(0.5, 2400), -8.0)        # "Little Mark" tag (20.2 s)
    put(fr(708), sfx_kick(0.35, 115, 38), -3.5)     # "Mr. Elon" (23.6 s)
    put(fr(708), sfx_bell(1.0, 1320), -8.0)
    put(fr(753), sfx_whoosh(0.34, 600, pan_pos=0.0), -7.0)
    put(fr(753), sfx_kaching(0.85), -8.0)           # money rain (25.1 s)

    # --- Shot 5: shock
    put(fr(816), sfx_kick(0.45, 135, 34), -2.0)     # "Wait," (27.2-27.6 s)
    put(fr(828), sfx_kick(0.40, 130, 36), -2.5)     # kick at 27.61 s
    put(fr(870), sfx_clink(0.5, 2600), -9.0)        # thought bubble pops (29.0 s)

    # --- Shot 6: run to the gate
    put(fr(911), sfx_whoosh(0.38, 1050, pan_pos=-0.3), -5.0)
    put(fr(911), sfx_kick(0.30, 130, 42), -5.0)

    # --- Shot 7: "Dad!"
    put(fr(981), sfx_kick(0.42, 140, 34), -2.0)     # "Dad," (32.68 s)
    put(fr(1002), sfx_bell(0.8, 1480), -9.0)        # Elon appears
    put(fr(1020), sfx_whoosh(0.32, 700, pan_pos=0.0), -8.0)

    # --- Shot 8: laugh, photo flip, record scratch
    put(fr(1044), sfx_whoosh(0.34, 700, pan_pos=0.2), -7.0)
    put(fr(1047), sfx_kick(0.34, 118, 38), -4.0)    # "Mr. Elon laughs" (34.9 s)
    put(fr(1110), sfx_whoosh(0.30, 900, pan_pos=0.3), -7.0)
    put(fr(1146), sfx_whoosh(0.30, 1250, pan_pos=-0.3), -5.0)   # flip (38.2 s)
    put(fr(1146), sfx_kick(0.34, 120, 38), -4.5)
    put(fr(1207), sfx_clink(0.5, 1900), -10.0)      # "No. 47" tag (40.24 s)
    put(fr(1260), sfx_scratch(0.6), -3.0)           # twist (42.0 s)
    put(fr(1260), sfx_kick(0.40, 140, 34), -3.0)

    # --- Shot 9: pat on the shoulder + guard cap
    put(fr(1275), sfx_whoosh(0.34, 650, pan_pos=0.0), -8.0)
    put(fr(1322), sfx_kick(0.26, 100, 50), -9.0)    # pat (44.1 s)
    put(fr(1331), sfx_kick(0.26, 100, 50), -9.0)
    put(fr(1363), sfx_kick(0.36, 120, 38), -4.0)    # "Yes," (45.44 s)
    put(fr(1385), sfx_whoosh(0.30, 950, pan_pos=0.3), -7.0)
    put(fr(1386), sfx_gavel(0.45), -6.0)            # cap lands on "security guard" (46.2 s)

    # --- Shot 10: employed!
    put(fr(1470), sfx_whoosh(0.36, 700, pan_pos=0.0), -6.0)
    put(fr(1470), sfx_kick(0.40, 130, 36), -3.0)    # "And just like that," (49.0 s)
    put(fr(1514), sfx_bell(1.0, 1480), -8.0)        # "Mark finally got a job" (50.5 s)
    put(fr(1514), sfx_clink(0.5, 2600), -9.0)
    put(fr(1560) - 0.45, sfx_flash(0.95), -2.5)     # FLASH_AT = 1560 (52.0 s)
    put(fr(1560), sfx_kaching(0.85), -4.5)

    return sfx

# ---------------------------------------------------------------- 4. Master Mix & Normalization
def main():
    print("Loading voiceover stem...")
    voice = load_voice()
    
    print("Generating procedural frame-accurate SFX stem...")
    sfx = generate_sfx()
    
    # Mix stems: Voice priority + motivated SFX beds
    mix = voice * 0.95 + sfx * 0.55
    
    # Apply soft limiter & loudness normalization to target -15 LUFS
    print("Normalizing master mix to target loudness...")
    lufs = integrated(mix)
    print(f"Initial mix loudness: {lufs:.2f} LUFS")
    gain = 10 ** ((TARGET_LUFS - lufs) / 20.0)
    norm = mix * gain
    
    # Peak limiter (ensure <= -1.2 dBTP). NOTE: dsp.true_peak() already returns dBTP.
    tp_db = true_peak(norm)
    print(f"Normalized True Peak: {tp_db:.2f} dBTP")
    if tp_db > CEIL_DBTP:
        reduction = 10 ** ((CEIL_DBTP - tp_db) / 20.0)
        norm = norm * reduction
        print(f"Limiter applied: reduced by {tp_db - CEIL_DBTP:.2f} dB -> {true_peak(norm):.2f} dBTP")

    out_wav = os.path.join(ROOT, "public", "anakpungut_mix.wav")
    print(f"Writing master audio file -> {out_wav}...")
    write_wav(out_wav, norm, SR)
    print("Master audio mix generated successfully!")

if __name__ == "__main__":
    main()
