#!/usr/bin/env python3
"""Original synthesized music bed + SFX for the Route 92 promo (placeholder a producer can swap).

120 BPM => one beat = 0.5s = 12 frames @24fps = 15 frames @30fps, so every cut sits on a beat.
Progression (city-pop feel): Fmaj7 | G6 | Em7 | Am7, one bar (2s) each.

usage: python3 scripts/make-audio.py   (writes public/audio/route92-mobile.wav and route92-desktop.wav)
"""
import subprocess, sys, tempfile, os, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
BEAT = 0.5
rng = np.random.default_rng(92)
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')


def mf(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(n): return np.arange(n) / SR
def lp(x, fc, o=2): return sosfilt(butter(o, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, o=2): return sosfilt(butter(o, fc, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def noise(n): return rng.standard_normal(n)
def attack(x, ms=4):
    k = max(1, int(SR * ms / 1000)); x = x.copy(); x[:k] *= np.linspace(0, 1, k); return x


# ---------- instruments ----------
def kick():
    n = int(0.42 * SR); t = tt(n); f = 44 + 95 * np.exp(-t / 0.028)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)
    s += 0.25 * lp(noise(n), 3000) * np.exp(-t / 0.004)
    return s * 0.95

def snare():
    n = int(0.28 * SR); t = tt(n)
    return (bp(noise(n), 1400, 7000) * np.exp(-t / 0.075) * 0.55 + np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05) * 0.3)

def hat(open_=False):
    n = int((0.22 if open_ else 0.07) * SR); t = tt(n)
    return hp(noise(n), 7500) * np.exp(-t / (0.07 if open_ else 0.016)) * 0.28

def bass(m, dur):
    n = int(dur * SR); t = tt(n); f = mf(m)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    return lp(attack(s * np.exp(-t / 0.42), 6), 700) * 0.7

def epiano(m, dur=1.4):
    n = int(dur * SR); t = tt(n); f = mf(m)
    mod = np.sin(2 * np.pi * f * t) * 1.6 * np.exp(-t / 0.22)
    s = np.sin(2 * np.pi * f * t + mod) + 0.28 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.3)
    return attack(s * np.exp(-t / 0.7), 5) * 0.22

def pad(ms, dur):
    n = int(dur * SR); t = tt(n); s = np.zeros(n)
    for m in ms:
        for det in (-0.07, 0.07):
            f = mf(m) * 2 ** (det / 12); s += np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28))
    env = np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 1.2)
    return lp(s * env, 1800) * 0.05

def pluck(m, dur=0.7):
    n = int(dur * SR); t = tt(n); f = mf(m); s = np.zeros(n)
    for k in range(1, 7): s += np.sin(2 * np.pi * k * f * t) / k ** 1.3 * np.exp(-t * (4 + 7 * k))
    return attack(s, 2) * 0.32

def bell(m, dur=1.6):
    n = int(dur * SR); t = tt(n); f = mf(m); s = np.zeros(n)
    for p, a, d in ((1, 1, 1.1), (2.76, 0.5, 0.7), (5.4, 0.25, 0.45), (8.93, 0.12, 0.3)):
        s += a * np.sin(2 * np.pi * f * p * t) * np.exp(-t / d)
    return attack(s, 1) * 0.33

def whoosh(dur, peak=0.8):
    n = int(dur * SR); t = tt(n); x = noise(n)
    bands = [lp(x, 500), bp(x, 400, 1500), bp(x, 1200, 4000), hp(x, 3500)]
    cen = np.linspace(0, 3, n) if peak > 0 else np.linspace(3, 0, n)
    out = sum(b * np.exp(-((cen - i) ** 2) / 0.5) for i, b in enumerate(bands))
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return out * env * 0.5

def thud():
    n = int(0.5 * SR); t = tt(n); f = 40 + 90 * np.exp(-t / 0.05)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12) + lp(noise(n), 500) * np.exp(-t / 0.05) * 0.6) * 0.9

def clack():
    n = int(0.09 * SR); t = tt(n); f = rng.uniform(650, 1700)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.014) + bp(noise(n), 900, 4200) * np.exp(-t / 0.01) * 0.5) * 0.4

def brake(dur):
    n = int(dur * SR); t = tt(n); env = np.minimum(1, t / 0.08) * np.exp(-t / (dur * 0.45))
    return hp(noise(n), 2500) * env * 0.22

def sea(dur):
    n = int(dur * SR); t = tt(n)
    return lp(noise(n), 900) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.11 * t)) * 0.07 * np.minimum(1, t / 1.5)

def engine(dur, f=42):
    n = int(dur * SR); t = tt(n); s = np.zeros(n)
    for k in range(1, 9): s += np.sin(2 * np.pi * f * k * t) / k
    return lp(s * (0.8 + 0.2 * np.sin(2 * np.pi * 7 * t)), 260) * 0.12 * np.minimum(1, t / 0.2) * np.minimum(1, (dur - t) / 0.4)


# ---------- mixer ----------
class Mix:
    def __init__(self, dur):
        self.n = int(dur * SR); self.dry = np.zeros((self.n, 2)); self.wet = np.zeros((self.n, 2))
    def add(self, t, s, g=1.0, pan=0.0, rev=0.0):
        i = int(round(t * SR))
        if i >= self.n or i + len(s) <= 0: return
        a = max(0, -i); i = max(0, i); j = min(self.n, i + len(s) - a); seg = s[a:a + j - i] * g
        l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
        self.dry[i:j, 0] += seg * l; self.dry[i:j, 1] += seg * r
        if rev: self.wet[i:j, 0] += seg * l * rev; self.wet[i:j, 1] += seg * r * rev
    def render(self):
        n = int(1.4 * SR); t = tt(n)
        ir = np.stack([lp(noise(n), 5000) * np.exp(-t / 0.42), lp(noise(n), 5000) * np.exp(-t / 0.42)], 1) * 0.05
        wet = np.stack([fftconvolve(self.wet[:, c], ir[:, c])[:self.n] for c in (0, 1)], 1)
        return self.dry + wet


CHORDS = [[53, 57, 60, 64], [55, 59, 62, 64], [52, 55, 59, 62], [57, 60, 64, 67]]  # Fmaj7 G6 Em7 Am7
ROOTS = [41, 43, 40, 45]
PENT = [72, 74, 76, 79, 81]
ARP = [0, 2, 3, 2, 4, 3, 2, 0]


def groove(m, t0, t1, drums=True, bass_=True, stabs=True, arp=False, hats=True, half=False, vel=1.0):
    t = t0
    while t < t1 - 1e-6:
        beat = round(t / BEAT); bar = int(t // 2) % 4; pos = beat % 4
        if drums:
            if pos == 0 or (pos == 2 and not half): m.add(t, kick(), 0.9 * vel)
            if pos in (1, 3) and not half: m.add(t, snare(), 0.55 * vel, rev=0.15)
            if pos == 2 and half: m.add(t, snare(), 0.5 * vel, rev=0.2)
        if hats and drums:
            m.add(t, hat(), 0.5 * vel, pan=-0.25); m.add(t + BEAT / 2, hat(pos == 3), 0.32 * vel, pan=0.25)
        if bass_ and pos in (0, 2, 3):
            off = 0 if pos != 3 else BEAT / 2
            m.add(t + off, bass(ROOTS[bar] + (12 if pos == 3 else 0), 0.45), 0.9 * vel)
        if stabs and pos in (0, 2):
            for k, n_ in enumerate(CHORDS[bar]): m.add(t + (0.0 if pos == 0 else BEAT / 2) + k * 0.006, epiano(n_), 0.8 * vel, pan=(k - 1.5) * 0.18, rev=0.35)
        if arp:
            for h in (0, 1):
                idx = ARP[(beat * 2 + h) % 8]; m.add(t + h * BEAT / 2, pluck(PENT[idx] + (12 if (beat // 4) % 2 else 0)), 0.55 * vel, pan=0.3 if h else -0.3, rev=0.4)
        t += BEAT


def tick(m, t, g=0.7): m.add(t, pluck(96, 0.12), g, rev=0.2)
def cta(m, t, dur):
    m.add(t, pad(CHORDS[0] + [65], dur), 1.6, rev=0.6)
    for k, n_ in enumerate(CHORDS[0]): m.add(t + k * 0.01, epiano(n_, 2.4), 1.0, pan=(k - 1.5) * 0.2, rev=0.5)
    m.add(t, bass(41, 1.4), 0.9)
    for k, n_ in enumerate([72, 76, 79, 81]): m.add(t + 0.25 * (k + 1), pluck(n_ + 0, 1.0), 0.55, pan=-0.2 + 0.13 * k, rev=0.55)
    m.add(t, bell(88), 0.6, rev=0.5)


def mobile():
    m = Mix(15.0)
    groove(m, 0.0, 12.5, arp=False)
    groove(m, 2.0, 12.5, arp=True, drums=False, bass_=False, stabs=False, hats=False)
    m.add(1.15, whoosh(0.9, 1), 0.9)                       # bus passes camera
    for t in (2.0, 4.5, 7.0, 9.5, 11.5): tick(m, t)           # every cut
    m.add(5.95, thud(), 0.9); [m.add(5.98 + rng.uniform(0, 0.7), clack(), 0.8, pan=rng.uniform(-.5, .5), rev=0.1) for _ in range(9)]  # crates
    m.add(12.0, brake(0.7), 0.9); m.add(12.5, bell(84), 0.75, rev=0.4); m.add(12.5, bell(79), 0.5, rev=0.4)  # stop: ding, then the breath
    m.add(12.5, engine(0.5), 0.8)
    cta(m, 13.0, 2.0)
    return m.render()


def desktop():
    m = Mix(45.0)
    m.add(0.0, sea(8.0), 1.0, rev=0.3); m.add(0.0, pad(CHORDS[0], 8.0), 1.0, rev=0.6)
    for k in range(4): m.add(1.0 + k * 1.5, pluck(PENT[[0, 2, 4, 3][k]], 1.2), 0.5, pan=-0.3 + 0.2 * k, rev=0.7)
    for k in range(0, 8, 2): m.add(5.0 + k * 0.25, kick(), 0.18 * (k + 2) / 8)  # soft kicks lead into the departure
    m.add(5.5, whoosh(1.5, 1), 0.5)
    groove(m, 7.0, 25.5, arp=False)
    groove(m, 12.0, 29.5, arp=True, drums=False, bass_=False, stabs=False, hats=False)
    for k, t in enumerate((12.0, 13.5, 15.0, 16.5, 18.0)): m.add(t, bell(72 + [0, 2, 4, 7, 9][k], 1.2), 0.5, pan=-0.3 + 0.15 * k, rev=0.4)  # modules 01-05
    for t in (7.0, 19.5, 25.5, 29.5, 32.5, 36.5): tick(m, t)
    m.add(22.95, thud(), 0.9); [m.add(22.98 + rng.uniform(0, 1.0), clack(), 0.8, pan=rng.uniform(-.6, .6), rev=0.1) for _ in range(12)]
    # East Dam: open, half-time, airy
    m.add(25.5, pad(CHORDS[3] + [69], 4.0), 1.4, rev=0.7); m.add(25.5, sea(4.0), 1.5, rev=0.4)
    groove(m, 25.5, 29.5, drums=True, bass_=True, stabs=False, hats=False, half=True, vel=0.8)
    # front seat builds back to full groove
    m.add(29.5, whoosh(1.5, 1), 0.5); groove(m, 29.5, 39.0, arp=False)
    groove(m, 29.5, 39.0, arp=True, drums=False, bass_=False, stabs=False, hats=False)
    m.add(38.5, brake(1.0), 0.9)
    m.add(39.0, bell(84), 0.8, rev=0.4); m.add(39.0, bell(79), 0.55, rev=0.4)          # stops under the arch, music ends
    m.add(39.0, engine(1.5), 0.9)                                                         # 1.5s breath before the CTA
    cta(m, 40.5, 4.5)
    return m.render()


def finish(x, name, lufs=-14.0):
    x = np.tanh(x * 1.1) / np.tanh(1.1)
    x = x / max(1e-9, np.abs(x).max()) * 0.9
    fade = int(0.25 * SR); x[-fade:] *= np.linspace(1, 0, fade)[:, None]
    tmp = tempfile.mktemp(suffix='.wav')
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype('<i2').tobytes())
    os.makedirs(OUT, exist_ok=True); dst = os.path.join(OUT, name)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-af', f'loudnorm=I={lufs}:TP=-1.5:LRA=9', '-ar', str(SR), '-c:a', 'pcm_s16le', dst], check=True)
    os.remove(tmp); print('wrote', dst)


if __name__ == '__main__':
    finish(mobile(), 'route92-mobile.wav')
    finish(desktop(), 'route92-desktop.wav')
