// Timeline of "Anak Pungut Sultan": 10 shots, ~30 multi-angle camera beats locked to anakpungut_vo.mp3 / .srt
// (1569 frames @ 30 fps = 52.3 s, YouTube Shorts 1080x1920).
// Same camera grammar as the reference story.ts: slow push-ins, smootherstep glides, hard cuts on reframes,
// 7-frame sign-flipping impact kicks on punchlines, 4-frame white flash at the end.
import { LightName } from "./lights";

export const FPS = 30;
export const TOTAL = 1569;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export type ShotDef = {
  id: number;
  a: number;
  b: number;
  light: LightName;
  sunAz?: number;
  sunEl?: number;
};

// 10 shots locked to the voiceover (seconds in comments)
export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 255,  light: "night",  sunAz: 46, sunEl: 36 }, //  0.0- 8.5  "Mark, 25 years old, 147 job applications, 147 rejections."
  { id: 2,  a: 255,  b: 438,  light: "night",  sunAz: 48, sunEl: 36 }, //  8.5-14.6  "Tonight, he has 2 dollars left and one packet of instant noodles."
  { id: 3,  a: 438,  b: 585,  light: "night",  sunAz: 44, sunEl: 35 }, // 14.6-19.5  "Desperate, he digs through an old box and a photo falls out."
  { id: 4,  a: 585,  b: 816,  light: "night",  sunAz: 48, sunEl: 37 }, // 19.5-27.2  "Little Mark in the arms of a man in a suit, Mr. Elon, the richest man..."
  { id: 5,  a: 816,  b: 911,  light: "space",  sunAz: 48, sunEl: 36 }, // 27.2-30.4  "Wait, is he my father?"
  { id: 6,  a: 911,  b: 975,  light: "day",    sunAz: 56, sunEl: 44 }, // 30.4-32.5  "Mark runs straight to the mansion."
  { id: 7,  a: 975,  b: 1044, light: "day",    sunAz: 54, sunEl: 43 }, // 32.5-34.8  "Dad, I'm home."
  { id: 8,  a: 1044, b: 1275, light: "day",    sunAz: 58, sunEl: 45 }, // 34.8-42.5  "Mr. Elon laughs and flips the photo over. Orphanage opening ceremony, adopted child number 47."
  { id: 9,  a: 1275, b: 1470, light: "day",    sunAz: 55, sunEl: 44 }, // 42.5-49.0  "So, I'm adopted? Yes, but don't worry, we need a security guard."
  { id: 10, a: 1470, b: TOTAL, light: "golden", sunAz: 52, sunEl: 40 }, // 49.0-52.3  "And just like that, Mark finally got a job."
];

export const XFADE: Record<number, number> = {};
export const FLASH_AT = 1560; // 52.0 s: ka-ching + 4-frame white flash

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) {
      return [
        { id: s.id - 1, alpha: 1 },
        { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) },
      ];
    }
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type WorldState = {
  id: number;
  f: number;
  t: number;
  u: number;
  setKind: "kos" | "mansion";
  showStars: boolean;
  showMoon: boolean;
  coinRot: number;
};

export const worldState = (id: number, f: number): WorldState => {
  const s = SHOTS[id - 1];
  const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
  const t = f / FPS;
  return { id, f, t, u, setKind: id <= 5 ? "kos" : "mansion", showStars: false, showMoon: false, coinRot: t * 2.4 };
};

// ---------------- Reference Camera Engine ----------------
export type CamPose = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<CamPose> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };

const mix = (a: CamPose, b: CamPose, k: number): CamPose => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3,
  look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k,
  roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): CamPose => ({ fov: 38, roll: 0, ...c });
const run = (keys: Key[], f: number): CamPose => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 22)));
  }
  return cur;
};
const T = (f: number) => f / FPS;

/** Push-in factor since f0: subject grows ~rate per frame; `punch` raises it for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 28) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 7, (n - i - 0.5) / 7));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<CamPose> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<CamPose> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });

// ---- Multi-angle beat framings (metres; characters stand at z ~ -0.6, kos room back wall z = -3.4, mansion gate z = -2.6) ----
// Shot 1 (0..255): Low Dutch MCU on Mark on his bed -> wide room (letters pile up) -> hard cut macro REJECTED stamp -> back to Mark
const S1a = (f: number) => dolly([0.2, 1.1, 3.3], [-0.72, 1.2, -1.9], pushK(f, 0, 0.003, 0.006, 16), { fov: 35, roll: -0.05 });
const S1b = (f: number) => dolly([0.1, 1.9, 6.4], [0.1, 1.2, -1.8], pushK(f, 105, 0.0022), { fov: 39, roll: 0.015 });
const S1c = (f: number) => dolly([0.85, 1.25, -0.3], [1.1, 0.88, -2.2], pushK(f, 174, 0.0035, 0.0075, 22), { fov: 32, roll: -0.055 });
const S1d = (f: number) => dolly([0.1, 1.25, 3.0], [-0.7, 1.2, -1.9], pushK(f, 215, 0.0032, 0.0065, 22), { fov: 34, roll: 0.04 });
// Shot 2 (255..438): MCU eating -> hard cut macro noodle pack on desk -> glide to MCU
const S2a = (f: number) => dolly([0.35, 1.2, 2.9], [-0.7, 1.2, -1.9], pushK(f, 255, 0.0032, 0.007, 22), { fov: 33, roll: 0.04 });
const S2b = (f: number) => dolly([0.9, 1.15, -0.2], [0.72, 0.88, -2.2], pushK(f, 340, 0.0034, 0.0075, 20), { fov: 30, roll: -0.05 });
const S2c = (f: number) => dolly([-0.1, 1.2, 2.6], [-0.72, 1.2, -1.9], pushK(f, 385, 0.003, 0.006, 22), { fov: 33, roll: -0.04 });
// Shot 3 (438..585): low Dutch push-in on Mark at the box -> macro into the box -> hard cut top-down on the falling photo
const S3a = (f: number) => dolly([-0.25, 1.2, 2.8], [0.35, 0.85, -1.4], pushK(f, 438, 0.003, 0.0065, 24), { fov: 36, roll: -0.05 });
const S3b = (f: number) => dolly([0.5, 1.0, 0.6], [0.35, 0.5, -1.2], pushK(f, 490, 0.0034, 0.007, 22), { fov: 32, roll: 0.05 });
const S3c = (f: number) => dolly([0.5, 1.8, 0.6], [0.5, 0.0, -0.9], pushK(f, 531, 0.003, 0.0065, 20), { fov: 34, roll: 0.03 });
// Shot 4 (585..816): macro photo insert -> push to baby Mark -> hard cut ECU Elon -> crane pull-back (money rain)
const S4a = (f: number) => dolly([0.0, 1.4, 2.3], [0.0, 1.32, -0.4], pushK(f, 585, 0.0028, 0.006, 22), { fov: 34, roll: 0.03 });
const S4b = (f: number) => dolly([0.1, 1.42, 1.9], [0.09, 1.38, -0.4], pushK(f, 645, 0.0034, 0.0075, 22), { fov: 30, roll: -0.04 });
const S4c = (f: number) => dolly([-0.1, 1.45, 1.9], [-0.12, 1.45, -0.4], pushK(f, 708, 0.0034, 0.0075, 24), { fov: 30, roll: 0.045 });
const S4d = (f: number) => dolly([0.0, 1.9, 4.4], [0.0, 1.3, -0.6], pushK(f, 753, 0.0024), { fov: 38, roll: -0.025 });
// Shot 5 (816..911): ECU shocked Mark (Dutch) -> pull-back with thought bubble
const S5a = (f: number) => dolly([0.05, 1.5, 2.0], [0.0, 1.42, -0.7], pushK(f, 816, 0.0035, 0.008, 24), { fov: 31, roll: -0.075 });
const S5b = (f: number) => dolly([-0.3, 1.6, 3.4], [0.1, 1.5, -0.7], pushK(f, 872, 0.0026), { fov: 36, roll: 0.06 });
// Shot 6 (911..975): tracking run to the gate
const S6a = (f: number) => dolly([-0.9, 1.3, 4.6], [-0.8, 1.25, -0.6], pushK(f, 911, 0.0024), { fov: 37, roll: -0.035 });
const S6b = (f: number) => dolly([0.2, 1.3, 4.2], [0.2, 1.25, -0.6], pushK(f, 930, 0.0026), { fov: 37, roll: 0.03 });
// Shot 7 (975..1044): MCU "Dad!" -> wide, Elon appears at the mansion door
const S7a = (f: number) => dolly([0.1, 1.5, 3.3], [0.0, 1.4, -0.7], pushK(f, 975, 0.0034, 0.0075, 22), { fov: 35, roll: 0.05 });
const S7b = (f: number) => dolly([0.0, 1.7, 5.5], [0.0, 1.3, -2.0], pushK(f, 1010, 0.0022), { fov: 38, roll: -0.02 });
// Shot 8 (1044..1275): two-shot -> macro photo flip -> Dutch two-shot -> ECU dazed Mark (record scratch)
const S8a = (f: number) => dolly([0.1, 1.45, 4.2], [0.0, 1.3, -0.6], pushK(f, 1044, 0.0026), { fov: 37, roll: -0.03 });
const S8b = (f: number) => dolly([0.0, 1.6, 2.6], [0.0, 1.62, -0.3], pushK(f, 1110, 0.0034, 0.0075, 22), { fov: 33, roll: 0.07 });
const S8c = (f: number) => dolly([0.1, 1.55, 3.6], [0.0, 1.45, -0.5], pushK(f, 1170, 0.0026), { fov: 36, roll: 0.075 });
const S8d = (f: number) => dolly([-0.5, 1.5, 2.3], [-0.55, 1.42, -0.6], pushK(f, 1245, 0.0036, 0.008, 22), { fov: 32, roll: -0.06 });
// Shot 9 (1275..1470): two-shot -> macro the pat on the shoulder -> cap insert -> glide wide
const S9a = (f: number) => dolly([0.1, 1.45, 4.0], [0.0, 1.3, -0.6], pushK(f, 1275, 0.0028, 0.006, 22), { fov: 37, roll: 0.03 });
const S9b = (f: number) => dolly([-0.05, 1.3, 2.2], [-0.1, 1.2, -0.6], pushK(f, 1330, 0.0034, 0.007, 22), { fov: 32, roll: -0.05 });
const S9c = (f: number) => dolly([0.5, 1.4, 2.4], [0.8, 1.25, -0.6], pushK(f, 1385, 0.0034, 0.0075, 22), { fov: 32, roll: 0.05 });
const S9d = (f: number) => dolly([0.0, 1.55, 4.4], [0.0, 1.3, -0.6], pushK(f, 1425, 0.0024), { fov: 38, roll: -0.03 });
// Shot 10 (1470..1569): low heroic push-in on guard Mark -> glide up-wide
const S10a = (f: number) => dolly([0.0, 0.9, 3.8], [0.0, 1.35, -0.6], pushK(f, 1470, 0.0035, 0.008, 28), { fov: 37, roll: 0.04 });
const S10b = (f: number) => dolly([0.0, 1.6, 5.0], [0.0, 1.4, -0.8], pushK(f, 1530, 0.0024), { fov: 38, roll: -0.02 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 105, dur: 20, s: S1b }, { f: 174, cut: true, s: S1c }, { f: 215, dur: 18, s: S1d }],
  2: [{ f: 255, s: S2a }, { f: 340, cut: true, s: S2b }, { f: 385, dur: 20, s: S2c }],
  3: [{ f: 438, s: S3a }, { f: 490, dur: 18, s: S3b }, { f: 531, cut: true, s: S3c }],
  4: [{ f: 585, s: S4a }, { f: 645, dur: 18, s: S4b }, { f: 708, cut: true, s: S4c }, { f: 753, dur: 22, s: S4d }],
  5: [{ f: 816, s: S5a }, { f: 872, dur: 20, s: S5b }],
  6: [{ f: 911, s: S6a }, { f: 930, dur: 38, s: S6b }],
  7: [{ f: 975, s: S7a }, { f: 1010, dur: 18, s: S7b }],
  8: [{ f: 1044, s: S8a }, { f: 1110, cut: true, s: S8b }, { f: 1170, dur: 20, s: S8c }, { f: 1245, cut: true, s: S8d }],
  9: [{ f: 1275, s: S9a }, { f: 1330, cut: true, s: S9b }, { f: 1385, cut: true, s: S9c }, { f: 1425, dur: 20, s: S9d }],
  10: [{ f: 1470, s: S10a }, { f: 1530, dur: 18, s: S10b }],
};

// Impact kicks on punchline words & hard angle cuts: [seconds, gain]
const KICKS: [number, number][] = [
  [14.60, 0.85], // cut: Mark digs in the box
  [17.70, 1.00], // photo falls out
  [19.50, 0.85], // photo insert
  [23.56, 1.05], // "Mr. Elon"
  [27.61, 1.35], // "Wait,"
  [30.37, 0.95], // cut to the gate
  [32.68, 1.25], // "Dad,"
  [34.90, 0.90], // "Mr. Elon laughs"
  [38.20, 1.10], // photo flips
  [42.00, 1.35], // record scratch: "adopted child number 47"
  [45.44, 1.00], // "Yes,"
  [49.00, 1.20], // "And just like that,"
  [52.00, 1.40], // ka-ching + white flash
];

export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};

export const camAt = (id: number, f: number): CamPose => {
  const c = run(CAMS[id] ?? CAMS[1], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return {
    ...c,
    look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m],
    roll: c.roll + a * 0.004,
  };
};

export const dofAt = (f: number): { cInf: number; focus?: (frame: number) => V3 } => {
  const s = shotAt(f);
  // Shallow DOF (cInf 10.8) on close-ups & macro inserts; crisp DOF (cInf 4.5) on wide shots
  if (
    (s.id === 1 && f >= 174 && f < 215) ||
    (s.id === 2 && f >= 340 && f < 385) ||
    (s.id === 3 && f >= 490) ||
    s.id === 4 ||
    s.id === 5 ||
    (s.id === 7 && f < 1010) ||
    (s.id === 8 && ((f >= 1110 && f < 1170) || f >= 1245)) ||
    (s.id === 9 && f >= 1330 && f < 1425) ||
    (s.id === 10 && f < 1530)
  ) {
    return { cInf: 10.8 };
  }
  return { cInf: 4.5, focus: () => (s.id <= 5 ? [-0.4, 1.1, -1.8] : [0.0, 1.3, -0.6]) };
};
