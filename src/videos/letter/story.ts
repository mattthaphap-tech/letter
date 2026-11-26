// Timeline of "A Letter 40 Years Late": 12 shots, ~30 camera beats locked to letter_vo.mp3 / letter_vo.srt
// (1784 frames @ 30 fps = 59.47 s, YouTube Shorts 1080x1920). Gentle emotional grammar: slow push-ins, few kicks, no flash.
import { LightName } from "./lights";

export const FPS = 30;
export const TOTAL = 1784;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export type ShotDef = { id: number; a: number; b: number; light: LightName; sunAz?: number; sunEl?: number };

// 12 shots locked to the voiceover (seconds in comments)
export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 162,   light: "day",    sunAz: 56, sunEl: 44 }, //  0.0- 5.4  "A letter waited forty years to be read. And it changed who her father was."
  { id: 2,  a: 162,  b: 306,   light: "day",    sunAz: 58, sunEl: 42 }, //  5.4-10.2  "After her grandmother Mary died, Sarah went to clean out the old house."
  { id: 3,  a: 306,  b: 510,   light: "day",    sunAz: 54, sunEl: 44 }, // 10.2-17.0  "In her grandmother's favorite book, she found a yellow envelope with no stamp and one name on it."
  { id: 4,  a: 510,  b: 618,   light: "day",    sunAz: 56, sunEl: 45 }, // 17.0-20.6  "To Mary, only when I'm gone."
  { id: 5,  a: 618,  b: 804,   light: "day",    sunAz: 52, sunEl: 42 }, // 20.6-26.8  "Inside, her great-grandmother wrote that the man Mary called father was not her real father."
  { id: 6,  a: 804,  b: 951,   light: "golden", sunAz: 50, sunEl: 34 }, // 26.8-31.7  "In the summer of nineteen fifty-one, Mary had met a soldier named Thomas."
  { id: 7,  a: 951,  b: 1062,  light: "night",  sunAz: 46, sunEl: 36 }, // 31.7-35.4  "He left for the war and never came back."
  { id: 8,  a: 1062, b: 1170,  light: "golden", sunAz: 52, sunEl: 36 }, // 35.4-39.0  "Daniel knew the truth. He married Mary anyway,"
  { id: 9,  a: 1170, b: 1320,  light: "golden", sunAz: 54, sunEl: 38 }, // 39.0-44.0  "raised her daughter as his own, and asked that no one ever speak of it."
  { id: 10, a: 1320, b: 1487,  light: "golden", sunAz: 48, sunEl: 32 }, // 44.0-49.6  "Sarah sat at the kitchen table, holding the letter, and finally understood her quiet grandfather."
  { id: 11, a: 1487, b: 1632,  light: "golden", sunAz: 50, sunEl: 32 }, // 49.6-54.4  "He had not hidden a lie. He had kept a promise."
  { id: 12, a: 1632, b: TOTAL, light: "golden", sunAz: 46, sunEl: 30 }, // 54.4-59.5  "And some truths wait forty years because love needs time."
];

export const XFADE: Record<number, number> = {};
export const FLASH_AT = 999999; // no white flash in this gentle story

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
  setKind: "house" | "orchard" | "station";
  showStars: boolean; showMoon: boolean; coinRot: number;
};

export const worldState = (id: number, f: number): WorldState => {
  const s = SHOTS[id - 1];
  const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
  const t = f / FPS;
  const setKind = id === 7 ? "station" : id === 6 || id === 8 || id === 9 ? "orchard" : "house";
  return { id, f, t, u, setKind, showStars: false, showMoon: false, coinRot: t * 2.4 };
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

// ---- Multi-angle beat framings (metres; actors stand at z ~ -0.8; house back wall z = -3.4, bookshelf x = -1.35, table (0.25, -1.35), Sarah's chair (-0.2, -1.95)) ----
// Shot 1 (0..162): macro on the yellow envelope -> hard cut wide: Sarah alone in the old house
const S1a = (f: number) => dolly([0.0, 1.4, 2.3], [0.0, 1.35, -0.4], pushK(f, 0, 0.0028, 0.006, 20), { fov: 34, roll: 0.025 });
const S1b = (f: number) => dolly([0.0, 1.6, 6.2], [0.0, 1.3, -1.8], pushK(f, 92, 0.0024), { fov: 38, roll: -0.02 });
// Shot 2 (162..306): MCU Sarah + framed photo of Mary -> glide wide on the boxes
const S2a = (f: number) => dolly([0.4, 1.4, 2.6], [-0.1, 1.45, -0.8], pushK(f, 162, 0.003, 0.0065, 22), { fov: 33, roll: 0.03 });
const S2b = (f: number) => dolly([0.2, 1.6, 6.0], [0.2, 1.2, -1.5], pushK(f, 240, 0.0024), { fov: 38, roll: -0.02 });
// Shot 3 (306..510): wide at the bookshelf -> macro book + envelope -> MCU Sarah
const S3a = (f: number) => dolly([-0.9, 1.5, 5.2], [-1.0, 1.3, -1.8], pushK(f, 306, 0.0026), { fov: 36, roll: -0.025 });
const S3b = (f: number) => dolly([-0.9, 1.5, 1.2], [-1.0, 1.5, -2.9], pushK(f, 365, 0.0032, 0.007, 22), { fov: 30, roll: 0.04 });
const S3c = (f: number) => dolly([0.0, 1.4, 2.7], [-0.4, 1.4, -0.8], pushK(f, 420, 0.003, 0.0065, 22), { fov: 33, roll: -0.03 });
// Shot 4 (510..618): macro the handwritten envelope
const S4a = (f: number) => dolly([0.0, 1.4, 2.2], [0.0, 1.35, -0.4], pushK(f, 510, 0.003, 0.0065, 22), { fov: 32, roll: -0.03 });
const S4b = (f: number) => dolly([0.05, 1.38, 1.8], [0.0, 1.34, -0.4], pushK(f, 570, 0.0034, 0.007, 22), { fov: 28, roll: 0.03 });
// Shot 5 (618..804): MCU Sarah reading -> macro the letter -> ECU shock
const S5a = (f: number) => dolly([0.3, 1.45, 2.8], [0.0, 1.4, -0.8], pushK(f, 618, 0.003, 0.0065, 22), { fov: 33, roll: 0.04 });
const S5b = (f: number) => dolly([0.0, 1.4, 2.0], [0.0, 1.38, -0.4], pushK(f, 690, 0.0032, 0.007, 22), { fov: 30, roll: -0.025 });
const S5c = (f: number) => dolly([0.0, 1.5, 1.9], [0.0, 1.5, -0.8], pushK(f, 722, 0.0036, 0.008, 22), { fov: 29, roll: -0.06 });
// Shot 6 (804..951): sunny orchard wide -> two-shot Mary + Thomas
const S6a = (f: number) => dolly([0.0, 1.5, 5.6], [0.0, 1.3, -1.0], pushK(f, 804, 0.0024), { fov: 38, roll: -0.02 });
const S6b = (f: number) => dolly([0.2, 1.45, 3.0], [0.0, 1.4, -0.8], pushK(f, 860, 0.003, 0.0065, 22), { fov: 33, roll: 0.04 });
// Shot 7 (951..1062): dusk station wide -> MCU Mary left on the platform
const S7a = (f: number) => dolly([0.0, 1.6, 6.0], [0.0, 1.4, -1.6], pushK(f, 951, 0.0024), { fov: 38, roll: -0.025 });
const S7b = (f: number) => dolly([-0.6, 1.4, 3.0], [-0.5, 1.35, -1.3], pushK(f, 1010, 0.003, 0.0065, 22), { fov: 33, roll: 0.04 });
// Shot 8 (1062..1170): MCU Daniel -> wide wedding
const S8a = (f: number) => dolly([0.3, 1.45, 2.7], [0.0, 1.4, -0.8], pushK(f, 1062, 0.003, 0.0065, 22), { fov: 33, roll: -0.03 });
const S8b = (f: number) => dolly([0.0, 1.5, 5.2], [0.0, 1.3, -0.9], pushK(f, 1117, 0.0024), { fov: 37, roll: 0.02 });
// Shot 9 (1170..1320): family wide -> MCU Daniel "shh"
const S9a = (f: number) => dolly([0.0, 1.4, 4.8], [0.0, 1.1, -0.8], pushK(f, 1170, 0.0024), { fov: 37, roll: -0.02 });
const S9b = (f: number) => dolly([-0.3, 1.45, 2.6], [-0.4, 1.4, -0.8], pushK(f, 1245, 0.0032, 0.007, 22), { fov: 32, roll: 0.04 });
// Shot 10 (1320..1487): kitchen wide (golden) -> MCU Sarah with the letter
const S10a = (f: number) => dolly([0.2, 1.5, 5.2], [0.0, 1.1, -1.6], pushK(f, 1320, 0.0024), { fov: 37, roll: -0.02 });
const S10b = (f: number) => dolly([0.3, 1.2, 2.6], [-0.2, 1.2, -1.9], pushK(f, 1390, 0.003, 0.0065, 22), { fov: 32, roll: 0.035 });
// Shot 11 (1487..1632): Sarah -> memory of old Daniel -> Sarah smiles
const S11a = (f: number) => dolly([0.3, 1.25, 2.8], [-0.2, 1.2, -1.9], pushK(f, 1487, 0.0028, 0.006, 22), { fov: 33, roll: -0.03 });
const S11b = (f: number) => dolly([0.9, 1.5, 3.2], [0.9, 1.4, -2.6], pushK(f, 1525, 0.003, 0.0065, 22), { fov: 32, roll: -0.04 });
const S11c = (f: number) => dolly([0.2, 1.25, 2.6], [-0.2, 1.2, -1.9], pushK(f, 1590, 0.003, 0.0065, 22), { fov: 32, roll: 0.03 });
// Shot 12 (1632..1784): slow push on Sarah -> crane pull-back to the whole room
const S12a = (f: number) => dolly([0.1, 1.3, 2.6], [-0.2, 1.25, -1.9], pushK(f, 1632, 0.0028, 0.006, 22), { fov: 32, roll: 0.025 });
const S12b = (f: number) => dolly([0.0, 1.8, 6.5], [0.0, 1.2, -1.6], pushK(f, 1700, 0.0022), { fov: 40, roll: -0.015 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 92, cut: true, s: S1b }],
  2: [{ f: 162, s: S2a }, { f: 240, dur: 22, s: S2b }],
  3: [{ f: 306, s: S3a }, { f: 365, cut: true, s: S3b }, { f: 420, cut: true, s: S3c }],
  4: [{ f: 510, s: S4a }, { f: 570, dur: 18, s: S4b }],
  5: [{ f: 618, s: S5a }, { f: 690, cut: true, s: S5b }, { f: 722, cut: true, s: S5c }],
  6: [{ f: 804, s: S6a }, { f: 860, dur: 20, s: S6b }],
  7: [{ f: 951, s: S7a }, { f: 1010, dur: 18, s: S7b }],
  8: [{ f: 1062, s: S8a }, { f: 1117, cut: true, s: S8b }],
  9: [{ f: 1170, s: S9a }, { f: 1245, cut: true, s: S9b }],
  10: [{ f: 1320, s: S10a }, { f: 1390, dur: 22, s: S10b }],
  11: [{ f: 1487, s: S11a }, { f: 1525, cut: true, s: S11b }, { f: 1590, cut: true, s: S11c }],
  12: [{ f: 1632, s: S12a }, { f: 1700, dur: 30, s: S12b }],
};

// Soft impact kicks only on the story's emotional beats: [seconds, gain]
const KICKS: [number, number][] = [
  [0.00, 0.80],  // the letter
  [3.05, 0.90],  // "it changed who her father was"
  [12.41, 1.00], // the yellow envelope
  [17.35, 0.90], // "To Mary, only when I'm gone."
  [24.05, 1.30], // "not her real father"
  [28.99, 0.80], // a soldier named Thomas
  [33.00, 1.00], // "never came back"
  [35.43, 0.90], // "Daniel knew the truth"
  [40.53, 0.80], // "asked that no one ever speak of it"
  [49.57, 1.00], // "not hidden a lie"
  [52.67, 1.10], // "kept a promise"
  [54.55, 0.90], // "some truths wait forty years"
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
    (s.id === 1 && f < 92) ||
    (s.id === 2 && f < 240) ||
    (s.id === 3 && f >= 365) ||
    s.id === 4 || s.id === 5 ||
    (s.id === 6 && f >= 860) ||
    (s.id === 7 && f >= 1010) ||
    (s.id === 8 && f < 1117) ||
    (s.id === 9 && f >= 1245) ||
    (s.id === 10 && f >= 1390) ||
    s.id === 11 ||
    (s.id === 12 && f < 1700)
  ) {
    return { cInf: 10.8 };
  }
  return { cInf: 4.5, focus: () => (s.id === 7 ? [0.0, 1.4, -1.6] : s.id >= 10 || s.id <= 5 ? [0.0, 1.1, -1.6] : [0.0, 1.3, -0.9]) };
};
