// Timeline of "The Man Who Sold the Eiffel Tower" (Victor Lustig): 10 shots, ~28 camera beats locked to lustig_vo.mp3 / lustig_vo.srt
// (1558 frames @ 30 fps = 51.93 s, YouTube Shorts 1080x1920).
// Same camera grammar as the reference story.ts: slow push-ins, smootherstep glides, hard cuts on reframes,
// 7-frame sign-flipping impact kicks on punchlines, 4-frame white flash at the end.
import { LightName } from "./lights";

export const FPS = 30;
export const TOTAL = 1558;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export type ShotDef = { id: number; a: number; b: number; light: LightName; sunAz?: number; sunEl?: number };

// 10 shots locked to the voiceover (seconds in comments)
export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 90,    light: "day",    sunAz: 56, sunEl: 46 }, //  0.0- 3.0  "He sold the Eiffel Tower. Twice."
  { id: 2,  a: 90,   b: 306,   light: "day",    sunAz: 58, sunEl: 44 }, //  3.0-10.2  "In May 1925, a con man named Victor Lustig arrived in Paris, pretending to be a French government official."
  { id: 3,  a: 306,  b: 465,   light: "day",    sunAz: 54, sunEl: 42 }, // 10.2-15.5  "He took them on a tour of the tower in a government car, like he already owned it."
  { id: 4,  a: 465,  b: 690,   light: "day",    sunAz: 56, sunEl: 45 }, // 15.5-23.0  "He picked the most ambitious one, André Poisson, and asked for a bribe on top of the price."
  { id: 5,  a: 690,  b: 960,   light: "day",    sunAz: 52, sunEl: 40 }, // 23.0-32.0  "And that's what made it work. A bribe makes a fake deal feel real..."
  { id: 6,  a: 960,  b: 1125,  light: "golden", sunAz: 50, sunEl: 36 }, // 32.0-37.5  "Poisson paid, and Lustig was on a train to Vienna..."
  { id: 7,  a: 1125, b: 1260,  light: "golden", sunAz: 52, sunEl: 34 }, // 37.5-42.0  "Poisson never called the police. He was too embarrassed."
  { id: 8,  a: 1260, b: 1386,  light: "day",    sunAz: 56, sunEl: 46 }, // 42.0-46.2  "So a month later, Lustig came back and tried to sell it again."
  { id: 9,  a: 1386, b: 1506,  light: "day",    sunAz: 58, sunEl: 44 }, // 46.2-50.2  "The police only caught him years later, for fake money."
  { id: 10, a: 1506, b: TOTAL, light: "night",  sunAz: 46, sunEl: 36 }, // 50.2-51.9  "Never for the tower."
];

export const XFADE: Record<number, number> = {};
export const FLASH_AT = 1539; // 51.3 s: end of the last line + 4-frame white flash

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) {
      return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
    }
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type WorldState = {
  id: number; f: number; t: number; u: number;
  setKind: "paris" | "station" | "cell";
  showStars: boolean; showMoon: boolean; coinRot: number;
};

export const worldState = (id: number, f: number): WorldState => {
  const s = SHOTS[id - 1];
  const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
  const t = f / FPS;
  return { id, f, t, u, setKind: id === 6 ? "station" : id === 10 ? "cell" : "paris", showStars: false, showMoon: false, coinRot: t * 2.4 };
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

// ---- Multi-angle beat framings (metres; characters stand at z ~ -0.7; Eiffel Tower at z = -15; cell back wall z = -3) ----
// Shot 1 (0..90): low heroic wide of the tower -> hard cut MCU smug Lustig
const S1a = (f: number) => dolly([0.0, 0.7, 4.6], [0.1, 4.8, -9.0], pushK(f, 0, 0.003, 0.006, 16), { fov: 50, roll: -0.03 });
const S1b = (f: number) => dolly([0.9, 1.35, 2.6], [0.45, 1.45, -0.7], pushK(f, 49, 0.0035, 0.008, 20), { fov: 33, roll: 0.05 });
// Shot 2 (90..306): tracking wide as Lustig arrives -> glide -> hard cut MCU on the fake government ID
const S2a = (f: number) => dolly([-0.9, 1.5, 5.0], [-0.5, 1.3, -0.7], pushK(f, 90, 0.0026), { fov: 37, roll: -0.03 });
const S2b = (f: number) => dolly([0.4, 1.4, 4.4], [0.2, 1.3, -0.7], pushK(f, 150, 0.0026), { fov: 37, roll: 0.03 });
const S2c = (f: number) => dolly([0.6, 1.45, 2.3], [0.2, 1.4, -0.7], pushK(f, 240, 0.0034, 0.0075, 22), { fov: 31, roll: 0.05 });
// Shot 3 (306..465): wide at the government car -> MCU the group -> hard cut low angle (tower behind)
const S3a = (f: number) => dolly([0.2, 1.3, 5.2], [0.4, 1.2, -1.2], pushK(f, 306, 0.0026), { fov: 38, roll: -0.03 });
const S3b = (f: number) => dolly([0.7, 1.5, 3.0], [0.5, 1.4, -0.8], pushK(f, 380, 0.003, 0.0065, 22), { fov: 34, roll: 0.04 });
const S3c = (f: number) => dolly([1.2, 0.7, 2.2], [0.9, 1.2, -2.0], pushK(f, 430, 0.0032, 0.007, 22), { fov: 36, roll: -0.05 });
// Shot 4 (465..690): wide line-up -> hard cut MCU Poisson -> hard cut two-shot on the bribe
const S4a = (f: number) => dolly([0.0, 1.6, 6.8], [0.0, 1.25, -0.7], pushK(f, 465, 0.0024), { fov: 38, roll: -0.03 });
const S4b = (f: number) => dolly([0.5, 1.4, 2.7], [0.18, 1.45, -0.7], pushK(f, 540, 0.0034, 0.0075, 22), { fov: 32, roll: 0.05 });
const S4c = (f: number) => dolly([-0.2, 1.3, 2.5], [-0.45, 1.2, -0.7], pushK(f, 605, 0.0034, 0.0075, 22), { fov: 31, roll: -0.05 });
// Shot 5 (690..960): macro cards (envelope / contract) -> closer on the stamp -> hard cut up to the rusting tower -> glide to Poisson
const S5a = (f: number) => dolly([0.0, 1.4, 2.2], [0.0, 1.35, -0.4], pushK(f, 690, 0.003, 0.0065, 22), { fov: 34, roll: 0.03 });
const S5b = (f: number) => dolly([0.05, 1.4, 1.9], [0.0, 1.38, -0.4], pushK(f, 748, 0.0034, 0.0075, 22), { fov: 30, roll: -0.04 });
const S5c = (f: number) => dolly([0.0, 0.8, 5.2], [0.0, 5.0, -14.0], pushK(f, 828, 0.003, 0.006, 20), { fov: 50, roll: 0.04 });
const S5d = (f: number) => dolly([0.4, 1.3, 3.4], [0.3, 1.3, -0.7], pushK(f, 900, 0.0026), { fov: 35, roll: -0.03 });
// Shot 6 (960..1125): station wide -> MCU Lustig waving -> hard cut golden wide
const S6a = (f: number) => dolly([0.0, 1.6, 6.0], [0.0, 1.4, -1.6], pushK(f, 960, 0.0024), { fov: 38, roll: -0.03 });
const S6b = (f: number) => dolly([0.6, 1.4, 3.0], [0.25, 1.35, -1.6], pushK(f, 1015, 0.0032, 0.007, 22), { fov: 34, roll: 0.05 });
const S6c = (f: number) => dolly([-0.8, 1.2, 5.0], [0.4, 1.3, -2.5], pushK(f, 1075, 0.0026), { fov: 38, roll: -0.03 });
// Shot 7 (1125..1260): MCU embarrassed Poisson -> hard cut ECU
const S7a = (f: number) => dolly([0.3, 1.4, 2.8], [0.0, 1.35, -0.7], pushK(f, 1125, 0.003, 0.0065, 24), { fov: 33, roll: -0.05 });
const S7b = (f: number) => dolly([0.0, 1.45, 1.9], [0.0, 1.45, -0.7], pushK(f, 1200, 0.0034, 0.0075, 22), { fov: 29, roll: 0.06 });
// Shot 8 (1260..1386): wide return -> MCU sly Lustig
const S8a = (f: number) => dolly([0.0, 1.6, 6.2], [0.0, 1.3, -0.7], pushK(f, 1260, 0.0026), { fov: 38, roll: -0.03 });
const S8b = (f: number) => dolly([0.4, 1.45, 2.6], [-0.2, 1.4, -0.7], pushK(f, 1320, 0.0034, 0.0075, 22), { fov: 32, roll: 0.05 });
// Shot 9 (1386..1506): wide arrest -> MCU cuffed Lustig -> macro fake bill
const S9a = (f: number) => dolly([0.0, 1.6, 5.6], [0.0, 1.3, -0.7], pushK(f, 1386, 0.0026), { fov: 38, roll: 0.03 });
const S9b = (f: number) => dolly([0.2, 1.4, 2.7], [0.0, 1.35, -0.7], pushK(f, 1440, 0.0034, 0.0075, 22), { fov: 32, roll: -0.06 });
const S9c = (f: number) => dolly([0.0, 1.4, 2.0], [0.0, 1.38, -0.3], pushK(f, 1485, 0.0034, 0.0075, 18), { fov: 30, roll: 0.04 });
// Shot 10 (1506..1558): MCU through the cell bars
const S10a = (f: number) => dolly([0.1, 1.35, 2.4], [0.0, 1.3, -0.9], pushK(f, 1506, 0.0035, 0.008, 24), { fov: 33, roll: 0.04 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 49, cut: true, s: S1b }],
  2: [{ f: 90, s: S2a }, { f: 150, dur: 20, s: S2b }, { f: 240, cut: true, s: S2c }],
  3: [{ f: 306, s: S3a }, { f: 380, dur: 18, s: S3b }, { f: 430, cut: true, s: S3c }],
  4: [{ f: 465, s: S4a }, { f: 540, cut: true, s: S4b }, { f: 605, cut: true, s: S4c }],
  5: [{ f: 690, s: S5a }, { f: 748, dur: 18, s: S5b }, { f: 828, cut: true, s: S5c }, { f: 900, dur: 22, s: S5d }],
  6: [{ f: 960, s: S6a }, { f: 1015, dur: 18, s: S6b }, { f: 1075, cut: true, s: S6c }],
  7: [{ f: 1125, s: S7a }, { f: 1200, cut: true, s: S7b }],
  8: [{ f: 1260, s: S8a }, { f: 1320, cut: true, s: S8b }],
  9: [{ f: 1386, s: S9a }, { f: 1440, cut: true, s: S9b }, { f: 1485, cut: true, s: S9c }],
  10: [{ f: 1506, s: S10a }],
};

// Impact kicks on punchline words & hard angle cuts: [seconds, gain]
const KICKS: [number, number][] = [
  [0.00, 1.20], // "He sold the Eiffel Tower."
  [1.64, 1.35], // "Twice."
  [3.16, 0.80], // arrival
  [8.00, 1.00], // fake official ID
  [10.20, 0.85], // car tour
  [15.50, 0.85], // line-up
  [17.70, 1.00], // "André Poisson"
  [20.16, 1.25], // the bribe
  [23.00, 0.90], // "that's what made it work"
  [24.92, 1.10], // "fake deal feels real"
  [27.62, 1.20], // "rusting tower"
  [32.02, 1.25], // "Poisson paid"
  [37.74, 1.10], // "never called the police"
  [42.00, 0.95], // a month later
  [46.34, 1.30], // "years later - fake money"
  [50.32, 1.40], // "Never for the tower."
  [51.30, 1.30], // flash
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
    (s.id === 1 && f >= 49) ||
    (s.id === 2 && f >= 240) ||
    (s.id === 3 && f >= 380) ||
    (s.id === 4 && f >= 540) ||
    (s.id === 5 && (f < 828 || f >= 900)) ||
    (s.id === 6 && f >= 1015 && f < 1075) ||
    s.id === 7 ||
    (s.id === 8 && f >= 1320) ||
    (s.id === 9 && f >= 1440) ||
    s.id === 10
  ) {
    return { cInf: 10.8 };
  }
  return { cInf: 4.5, focus: () => (s.id === 6 ? [0.0, 1.4, -1.6] : [0.0, 1.3, -0.7]) };
};
