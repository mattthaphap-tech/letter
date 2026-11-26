#!/usr/bin/env python3
"""
Procedural SFX + Voiceover Master Mix Generator for:
"The Man Who Sold the Eiffel Tower" (1558 frames @ 30 fps = 51.933 s, YouTube Shorts).

Same pipeline as gen-audio.py, locked to src/videos/lustig/story.ts:
  - voice stem: public/lustig_vo.mp3
  - frame-accurate SFX: whooshes on cuts, impact kicks on punchlines, SOLD bell, cash register on bribes,
    train whistle, handcuff clinks, jail-door gavel, flash at FLASH_AT = 1539
  - master loudness normalisation with a true-peak ceiling (dsp.true_peak returns dBTP directly)
Outputs `public/lustig_mix.wav`.
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
TOTAL_FRAMES = 1558
DUR = TOTAL_FRAMES / FPS  # 51.933 s
N = ns(DUR)
TARGET_LUFS = -15.0
CEIL_DBTP = -1.2
SFX_DB = -5.5

def fr(f):
    return float(f) / FPS

# ---------------------------------------------------------------- 1. Load Voiceover
def load_voice():
    mp3_path = os.path.join(ROOT, "public", "lustig_vo.mp3")
    tmp_wav = os.path.join(ROOT, "public", "_lustig_voice_48k.wav")
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

def sfx_whistle(dur=0.9):
    """steam-train whistle: two detuned tones with vibrato"""
    t = tt(dur)
    f = 880 + 25 * np.sin(2 * np.pi * 6 * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.8 * np.sin(2 * np.pi * np.cumsum(f * 1.26) / SR)
    env = np.minimum(t / 0.05, 1.0) * np.exp(-((t / dur) ** 2) * 2.5)
    return pan(x * env * 0.5, 0.0)

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

    # --- Shot 1: hook
    put(fr(0), sfx_kick(0.45, 140, 34), -2.5)       # "He sold the Eiffel Tower."
    put(fr(0), sfx_bell(1.0, 1500), -8.0)           # SOLD!
    put(fr(49), sfx_scratch(0.5), -4.0)             # "Twice." (1.64 s)
    put(fr(49), sfx_kick(0.36, 125, 36), -3.5)

    # --- Shot 2: arrival + fake ID
    put(fr(90), sfx_whoosh(0.34, 700, pan_pos=-0.2), -7.0)
    put(fr(95), sfx_kick(0.28, 110, 44), -8.0)      # arrival (3.16 s)
    put(fr(240), sfx_clink(0.5, 2200), -7.0)        # ID card (8.0 s)
    put(fr(240), sfx_kick(0.32, 120, 38), -5.0)

    # --- Shot 3: government car tour
    put(fr(306), sfx_whoosh(0.34, 650, pan_pos=0.2), -7.0)
    put(fr(306), sfx_kick(0.30, 110, 42), -6.0)
    put(fr(380), sfx_whoosh(0.30, 850, pan_pos=-0.2), -8.0)
    put(fr(411), sfx_kick(0.30, 105, 44), -6.0)     # "like he already owned it" (13.7 s)
    put(fr(430), sfx_whoosh(0.30, 950, pan_pos=0.3), -8.0)

    # --- Shot 4: the pick + the bribe
    put(fr(465), sfx_whoosh(0.34, 700, pan_pos=0.0), -7.0)
    put(fr(531), sfx_bell(0.9, 1400), -8.5)         # "André Poisson" (17.7 s)
    put(fr(531), sfx_kick(0.32, 120, 38), -5.0)
    put(fr(540), sfx_whoosh(0.28, 900, pan_pos=0.3), -8.0)
    put(fr(605), sfx_kaching(0.85), -3.5)           # bribe (20.16 s)
    put(fr(605), sfx_kick(0.40, 130, 36), -3.0)

    # --- Shot 5: contract + rusting tower
    put(fr(690), sfx_whoosh(0.34, 700, pan_pos=0.0), -6.5)
    put(fr(748), sfx_clink(0.5, 2400), -9.0)        # contract appears (24.92 s)
    put(fr(765), sfx_gavel(0.45), -3.0)             # OFFICIAL stamp (25.5 s)
    put(fr(765), sfx_kick(0.36, 115, 38), -4.0)
    put(fr(828), sfx_whoosh(0.36, 600, pan_pos=0.0), -6.0)
    put(fr(829), sfx_kick(0.45, 100, 32), -3.0)     # "rusting tower" (27.62 s)
    put(fr(852), sfx_kaching(0.85), -9.0)           # money flying away (28.4 s)

    # --- Shot 6: paid, train whistle
    put(fr(961), sfx_kaching(0.85), -3.5)           # "Poisson paid" (32.02 s)
    put(fr(961), sfx_kick(0.38, 125, 36), -4.0)
    put(fr(985), sfx_whistle(0.95), -7.0)           # train whistle
    put(fr(1015), sfx_whoosh(0.30, 800, pan_pos=0.2), -8.0)
    put(fr(1075), sfx_whoosh(0.34, 650, pan_pos=-0.2), -8.0)

    # --- Shot 7: embarrassed Poisson
    put(fr(1125), sfx_whoosh(0.34, 600, pan_pos=0.0), -8.0)
    put(fr(1132), sfx_kick(0.34, 110, 40), -4.5)    # "never called the police" (37.74 s)
    put(fr(1207), sfx_kick(0.30, 95, 46), -7.0)     # "too embarrassed" (40.24 s)

    # --- Shot 8: a month later
    put(fr(1260), sfx_whoosh(0.34, 700, pan_pos=0.0), -6.5)
    put(fr(1260), sfx_bell(1.0, 1180), -9.0)        # calendar chime (42.0 s)
    put(fr(1344), sfx_kick(0.34, 115, 38), -4.5)    # "FOR SALE. AGAIN." (44.8 s)

    # --- Shot 9: the arrest
    put(fr(1386), sfx_whoosh(0.34, 700, pan_pos=0.0), -6.5)
    put(fr(1390), sfx_bell(0.9, 1500), -8.0)        # "years later" (46.34 s)
    put(fr(1416), sfx_clink(0.5, 2000), -5.0)       # handcuffs (47.2 s)
    put(fr(1422), sfx_clink(0.5, 2500), -6.0)
    put(fr(1434), sfx_kick(0.38, 125, 36), -4.0)    # "FAKE MONEY" (47.8 s)
    put(fr(1482), sfx_scratch(0.5), -5.0)           # fake bill (49.4 s)

    # --- Shot 10: the cell
    put(fr(1510), sfx_gavel(0.5), -2.5)             # cell door (50.32 s)
    put(fr(1510), sfx_kick(0.45, 120, 34), -2.5)
    put(fr(1539) - 0.4, sfx_flash(0.9), -3.0)       # FLASH_AT = 1539 (51.3 s)
    put(fr(1539), sfx_kaching(0.85), -5.0)

    return sfx

# ---------------------------------------------------------------- 4. Master Mix & Normalization
def main():
    print("Loading voiceover stem...")
    voice = load_voice()
    
    print("Generating procedural frame-accurate SFX stem...")
    sfx = generate_sfx()
    
    # Mix stems: Voice priority + motivated SFX beds
    mix = voice * 0.95 + sfx * 0.22
    
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

    out_wav = os.path.join(ROOT, "public", "lustig_mix.wav")
    print(f"Writing master audio file -> {out_wav}...")
    write_wav(out_wav, norm, SR)
    print("Master audio mix generated successfully!")

if __name__ == "__main__":
    main()
