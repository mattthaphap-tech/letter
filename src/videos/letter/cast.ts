// 2D Character Cast & Cartoon Effect Cards for "A Letter 40 Years Late" (Sarah, Mary, Thomas, Daniel, letter cards).
// Uses 3x supersampled (1800x3000) lit cardShade sprites, contact/cast shadow blobs, and NOINK layer 3.
// Follows skill/references/reports/motion.md & Gold Benchmark kosan/cast.ts:
// - Bouncy walk cycles ("march" / "stroll" with 4.8% height bob & weight-shift sway)
// - Hop / jump arcs with crouch anticipation on celebration & shock beats
// - 4-frame half/shut/shut/half blinks timed 2 frames (LEAD = 2/FPS) before expression swaps
// - Popping 2D FX cards (fxBurst, fxStars, fxCreak, fxMoneyFly, fxCryptoSwarm, fxBadge)
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, fxShadow, fxContact, fxBurst, fxStars, fxCreak,
  Outfit, FrontOpts, SideOpts, INK,
  SARAH_OUTFIT, MARY_Y_OUTFIT, THOMAS_OUTFIT, DANIEL_Y_OUTFIT, DANIEL_O_OUTFIT, GIRL_OUTFIT, Expr,
} from "./toon";
import { FPS, SHOTS, clamp01, smooth, lerp, easeOut, WorldState } from "./story";
import { LightName } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
const ROOTS = new Set<THREE.Object3D>();

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}

export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else {
      this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0;
    }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;

const tier = (d: number): [number, number, number] =>
  d < 8.5 ? [1800, 3000, 3.0] : d < 14 ? [1080, 1800, 1.8] : [480, 800, 0.8];

const SUN = new THREE.Vector3(0.5, 0.75, 0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: LightName = "golden";

const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

// ---------------- blinks, expression swaps & micro-motion helpers ----------------
const LEAD = 2 / FPS;
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 48 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));
const liveTilt = (t: number, seed: number, amp = 2.6) => q(amp * Math.sin(t * 3.2 + seed), 30);
const liveHead = (t: number, seed: number, amp = 4.0) => q(amp * Math.sin(t * 2.4 + seed * 1.7) + (amp * 0.4) * Math.cos(t * 4.1 + seed), 30);

/** Parabolic hop/jump arc with a 3-frame crouch anticipation */
const hopY = (t: number, t0: number, dur = 0.42, height = 0.16): number => {
  const dt = t - t0;
  if (dt < -0.08 || dt > dur) return 0;
  if (dt < 0) return -0.025 * Math.sin(((dt + 0.08) / 0.08) * Math.PI);
  const u = dt / dur;
  return height * 4 * u * (1 - u);
};

type Who = { i: number; o: Outfit; okey: string };
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, side: boolean, mirror: boolean, fo: FrontOpts, so: SideOpts, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const m = side && mirror, light = light2D(cam, m), seed = ((who.i * 5 + 3) % 7) + 1;
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror: m,
    draw: (p) => (side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

const CONTACT: Record<LightName, [number, number, number]> = {
  space: [0.18, 0.16, 0.32],
  night: [0.18, 0.16, 0.30],
  golden: [0.24, 0.20, 0.33],
  day: [0.20, 0.21, 0.33],
};
const TAIL: [number, number, number] = [0.38, 0.36, 0.56];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");

const blob = (out: Stage, x: number, _y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  const el = Math.asin(Math.min(0.99, Math.max(0.15, SUN.y)));
  const len = Math.min(2.2, Math.max(0.5, 1.4 / Math.tan(el))) * sc, h = len + 0.5 * sc, c = 0.3 * h;
  const tc = hexOf(TAIL, k);
  out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: 0.022, z: z + oz * 0.03 * sc, w: 0.54 * sc, h: 0.42 * sc, flat: true, rot });
};

// ---------------- 2D Cartoon FX Cards ----------------

/** Flying Rupiah Money Notes & Gold Coins Card (520x520) */
const fxMoneyFly = (p: Pen, phase: number) => {
  const g = p.g;
  const bills = [
    [130, 260, -0.28, "#2ecc71"],
    [260, 150, 0.16, "#27ae60"],
    [380, 250, 0.34, "#2ecc71"],
  ] as const;
  for (let i = 0; i < bills.length; i++) {
    const [bx, by, rot, col] = bills[i];
    const y = by - ((phase * 95 + i * 40) % 110);
    const x = bx + Math.sin(phase * 4 + i * 2) * 16;
    g.save();
    g.translate(x, y);
    g.rotate(rot + Math.sin(phase * 3 + i) * 0.12);
    g.fillStyle = col;
    g.strokeStyle = INK;
    g.lineWidth = 8;
    g.beginPath();
    g.roundRect(-62, -32, 124, 64, 10);
    g.fill(); g.stroke();
    g.fillStyle = "#fff8e7";
    g.beginPath();
    g.arc(0, 0, 18, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.fillStyle = INK;
    g.font = "900 22px 'Segoe UI', Arial, sans-serif";
    g.textAlign = "center";
    g.fillText("$", 0, 8);
    g.restore();
  }
  for (const [cx, cy, off] of [[185, 360, 0.5], [335, 350, 1.8], [260, 95, 3.1]] as const) {
    const y = cy + Math.sin(phase * 5 + off) * 14;
    g.fillStyle = "#ffd43b";
    g.strokeStyle = INK;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(cx, y, 22, 0, Math.PI * 2);
    g.fill(); g.stroke();
  }
};

/** Comic Floating Price / Alert Badge (560x260) — auto-fits text with generous internal padding so it NEVER overflows the box! */
const fxBadge = (p: Pen, text: string, sub: string, bg: string, fg: string) => {
  const g = p.g;
  g.fillStyle = INK;
  g.beginPath();
  g.roundRect(24, 34, 512, 196, 28);
  g.fill();

  g.fillStyle = bg;
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.beginPath();
  g.roundRect(16, 22, 512, 196, 28);
  g.fill();
  g.stroke();

  g.fillStyle = fg;
  g.textAlign = "center";

  // Auto-fit main heading within max width 456 px
  let mainSz = 50;
  g.font = `900 ${mainSz}px 'Segoe UI', Arial, sans-serif`;
  while (g.measureText(text).width > 456 && mainSz > 26) {
    mainSz -= 2;
    g.font = `900 ${mainSz}px 'Segoe UI', Arial, sans-serif`;
  }
  g.fillText(text, 272, 112);

  // Auto-fit subtitle within max width 456 px
  let subSz = 31;
  g.font = `800 ${subSz}px 'Segoe UI', Arial, sans-serif`;
  while (g.measureText(sub).width > 456 && subSz > 18) {
    subSz -= 2;
    g.font = `800 ${subSz}px 'Segoe UI', Arial, sans-serif`;
  }
  g.fillText(sub, 272, 174);
};

// ---------------- Story-specific FX cards ----------------
const HAND = "'Segoe Script', 'Comic Sans MS', 'Brush Script MT', cursive";

/** The yellow envelope: "To Mary, only when I'm gone." (400 x 280) */
const fxYellowEnv = (p: Pen) => {
  const g = p.g;
  g.lineJoin = "round"; g.lineCap = "round";
  g.fillStyle = "#f2c94c"; g.strokeStyle = INK; g.lineWidth = 8;
  g.beginPath(); g.roundRect(4, 4, 392, 272, 12); g.fill(); g.stroke();
  g.fillStyle = "#e2b53a"; g.beginPath(); g.moveTo(4, 4); g.lineTo(200, 128); g.lineTo(396, 4); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "rgba(120,80,20,0.18)"; g.beginPath(); g.ellipse(330, 230, 40, 26, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#3a2a22"; g.textAlign = "center";
  g.font = `italic 44px ${HAND}`; g.fillText("To Mary,", 200, 186);
  g.font = `italic 30px ${HAND}`; g.fillText("only when I'm gone.", 200, 232);
};

/** The letter: handwritten lines, the "father" line underlined in red (400 x 520) */
const fxLetter = (p: Pen, mark: number) => {
  const g = p.g;
  g.lineJoin = "round"; g.lineCap = "round";
  g.fillStyle = "#fbf4dc"; g.strokeStyle = INK; g.lineWidth = 8;
  g.beginPath(); g.roundRect(4, 4, 392, 512, 10); g.fill(); g.stroke();
  g.fillStyle = "#3a2a22"; g.textAlign = "left";
  g.font = `italic 34px ${HAND}`; g.fillText("My dearest Mary,", 36, 76);
  g.strokeStyle = "rgba(58,42,34,0.35)"; g.lineWidth = 3;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(36, 118 + i * 34); g.lineTo(364 - i * 30, 118 + i * 34); g.stroke(); }
  g.fillStyle = "#3a2a22"; g.font = `italic 31px ${HAND}`;
  g.fillText("the man you call father", 36, 262);
  g.fillText("is not your real father.", 36, 304);
  if (mark > 0.01) {
    g.strokeStyle = "#d62f2f"; g.lineWidth = 6; g.globalAlpha = Math.min(1, mark * 1.5);
    g.beginPath(); g.moveTo(34, 316); g.quadraticCurveTo(190, 330 - 6 * mark, 366, 314); g.stroke(); g.globalAlpha = 1;
  }
  g.strokeStyle = "rgba(58,42,34,0.35)"; g.lineWidth = 3;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(36, 360 + i * 34); g.lineTo(364 - (i === 3 ? 140 : 0), 360 + i * 34); g.stroke(); }
};

/** Framed portrait of Grandma Mary with a black mourning ribbon (360 x 440) */
const fxFramedPhoto = (p: Pen) => {
  const g = p.g;
  g.lineJoin = "round"; g.lineCap = "round";
  g.fillStyle = "#8a6a3b"; g.strokeStyle = INK; g.lineWidth = 8;
  g.beginPath(); g.roundRect(4, 4, 352, 432, 10); g.fill(); g.stroke();
  g.fillStyle = "#d8cdb4"; g.fillRect(28, 28, 304, 384); g.lineWidth = 5; g.strokeRect(28, 28, 304, 384);
  g.fillStyle = "#6b7b94"; g.beginPath(); g.moveTo(60, 412); g.quadraticCurveTo(70, 300, 180, 292); g.quadraticCurveTo(290, 300, 300, 412); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#fcfaf5"; g.beginPath(); g.arc(180, 210, 82, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = "#e8e8ee"; g.beginPath(); g.moveTo(98, 200); g.quadraticCurveTo(96, 112, 180, 116); g.quadraticCurveTo(264, 112, 262, 200); g.quadraticCurveTo(240, 150, 180, 150); g.quadraticCurveTo(120, 150, 98, 200); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 5;
  for (const ex of [150, 210]) { g.beginPath(); g.arc(ex, 212, 20, 0, Math.PI * 2); g.stroke(); }
  g.beginPath(); g.moveTo(170, 212); g.lineTo(190, 212); g.stroke();
  g.fillStyle = INK; for (const ex of [150, 210]) { g.beginPath(); g.arc(ex, 213, 5, 0, Math.PI * 2); g.fill(); }
  g.lineWidth = 6; g.beginPath(); g.moveTo(148, 252); g.quadraticCurveTo(180, 282, 212, 252); g.stroke();
  g.fillStyle = "#1a1a22"; g.beginPath(); g.moveTo(4, 4); g.lineTo(110, 4); g.lineTo(4, 110); g.closePath(); g.fill();
};

/** Floating pink hearts (300 x 300) */
const fxHearts = (p: Pen, phase: number) => {
  const g = p.g;
  g.lineJoin = "round";
  const heart = (cx: number, cy: number, s: number, col: string) => {
    g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(cx, cy + 34 * s);
    g.bezierCurveTo(cx - 70 * s, cy - 10 * s, cx - 38 * s, cy - 60 * s, cx, cy - 22 * s);
    g.bezierCurveTo(cx + 38 * s, cy - 60 * s, cx + 70 * s, cy - 10 * s, cx, cy + 34 * s);
    g.closePath(); g.fill(); g.stroke();
  };
  heart(150, 170 - phase * 40, 1.2, "#ff6b9a");
  heart(70, 210 - phase * 60, 0.7, "#ff9ac0");
  heart(230, 200 - phase * 50, 0.8, "#ff8fb8");
};

// ---------------- Character Roster ----------------
const WHO_SARAH: Who = { i: 1, o: SARAH_OUTFIT, okey: "sarah" };
const WHO_MARY: Who = { i: 2, o: MARY_Y_OUTFIT, okey: "maryY" };
const WHO_THOMAS: Who = { i: 3, o: THOMAS_OUTFIT, okey: "thomas" };
const WHO_DANIEL: Who = { i: 4, o: DANIEL_Y_OUTFIT, okey: "danielY" };
const WHO_DANIEL_O: Who = { i: 5, o: DANIEL_O_OUTFIT, okey: "danielO" };
const WHO_GIRL: Who = { i: 6, o: GIRL_OUTFIT, okey: "girl" };

// ---------------- Stage Characters & 2D Effects Across All 12 Shots ----------------
export const stage = (ws: WorldState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const { id, t } = ws;
  LNAME = SHOTS[id - 1].light;
  findSun(cam, SUN);

  const addChar = (
    who: Who, x: number, y: number, z: number, fo: FrontOpts,
    scale = 0.84, shadow = true, side = false, mirror = false, so: SideOpts = {},
  ) => {
    out.places.push(person(cam, who, x, y, z, side, mirror, fo, so, scale));
    if (shadow) blob(out, x, y, z, scale * 0.95);
  };

  /** pop-in comic badge visible during [t0, t1) */
  const badge = (key: string, text: string, sub: string, bg: string, fg: string, x: number, y: number, z: number, t0: number, t1: number, w = 0.7) => {
    if (t < t0 || t >= t1) return;
    const s = easeOut(clamp01((t - t0) / 0.2));
    out.fx.push({
      key: `fx|badge|${key}`, cw: 560, ch: 260,
      draw: (p) => fxBadge(p, text, sub, bg, fg),
      x, y: y + Math.sin(t * 2.6) * 0.025, z, w: w * s, h: w * s * 0.4615,
    });
  };

  const std = (who: Who, ex: Expr, extra: Partial<FrontOpts> = {}): FrontOpts => ({
    mode: "stand", phase: q(t * 0.8 + who.i, 20), expr: ex, blink: lidAt(t, who.i),
    tilt: liveTilt(t, who.i, 1.8), headTilt: liveHead(t, who.i, 2.6), look: 0, facing: 0, ...extra,
  });

  const hearts = (key: string, x: number, y: number, z: number, w: number, t0: number, t1: number) => {
    if (t < t0 || t >= t1) return;
    const ph = q(((t - t0) * 0.6) % 1, 20), s = easeOut(clamp01((t - t0) / 0.3));
    out.fx.push({ key: `fx|hearts|${key}|${ph}`, cw: 300, ch: 300, draw: (p) => fxHearts(p, ph), x, y, z, w: w * s, h: w * s });
  };

  if (id === 1) {
    // Shot 1 (0..5.4): the envelope waited forty years -> Sarah holding it
    if (t < 3.05) {
      out.fx.push({ key: "fx|yenv", cw: 400, ch: 280, draw: (p) => fxYellowEnv(p), x: 0.0, y: 1.35, z: -0.4, w: 0.62, h: 0.434, rot: Math.sin(t * 1.8) * 0.03 });
      badge("40", "40 YEARS", "WAITING TO BE READ", "#ffd43b", INK, 0.0, 1.95, -0.3, 0.2, 3.05, 0.6);
    } else {
      addChar(WHO_SARAH, 0.0, 0, -1.0, std(WHO_SARAH, "pained", { prop: "yellowEnv" }), 0.86);
      badge("who", "WHO WAS HER FATHER?", "ONE LETTER CHANGED IT", "#ffffff", INK, 0.0, 2.45, -0.5, 3.05, 5.4, 1.0);
    }
  } else if (id === 2) {
    // Shot 2 (5.4..10.2): Grandma Mary died; Sarah cleans out the old house
    addChar(WHO_SARAH, 0.0, 0, -0.9, std(WHO_SARAH, "pained", t >= 8.03 ? { prop: "suitcase" } : {}), 0.86);
    if (t >= 5.69 && t < 8.03) {
      const s = easeOut(clamp01((t - 5.69) / 0.3));
      out.fx.push({ key: "fx|framed", cw: 360, ch: 440, draw: (p) => fxFramedPhoto(p), x: -0.5, y: 1.55, z: -0.4, w: 0.38 * s, h: 0.465 * s, rot: -0.04 });
    }
    badge("mary", "GRANDMA MARY", "IN LOVING MEMORY", "#3a3a4a", "#ffffff", -0.35, 2.35, -0.4, 5.69, 8.03, 0.8);
    badge("clean", "CLEANING OUT", "THE OLD HOUSE", "#ffd43b", INK, 0.2, 2.4, -0.5, 8.03, 10.2, 0.8);
  } else if (id === 3) {
    // Shot 3 (10.2..17.0): the favourite book; the yellow envelope falls out of it
    const found = t >= 12.41;
    addChar(WHO_SARAH, -0.5, 0, -0.9, std(WHO_SARAH, found ? "shock" : "nervous", { prop: found ? "yellowEnv" : "point_up", look: -1, facing: -1 }), 0.86);
    badge("book", "GRANDMA'S", "FAVORITE BOOK", "#ffffff", INK, -0.9, 2.65, -0.8, 10.43, 12.41, 0.8);
    badge("yenv", "A YELLOW ENVELOPE", "HIDDEN INSIDE", "#ffd43b", INK, -0.35, 2.4, -0.5, 12.41, 13.65, 0.95);
    badge("nostamp", "NO STAMP", "NOT EVEN ONE", "#e23b3b", "#ffffff", -0.35, 2.4, -0.5, 13.65, 15.2, 0.8);
    badge("onename", "ONE NAME", "ON THE FRONT", "#3a8fdb", "#ffffff", -0.35, 2.4, -0.5, 15.2, 17.0, 0.8);
  } else if (id === 4) {
    // Shot 4 (17.0..20.6): "To Mary, only when I'm gone." (macro on the envelope)
    out.fx.push({ key: "fx|yenv", cw: 400, ch: 280, draw: (p) => fxYellowEnv(p), x: 0.0, y: 1.35, z: -0.4, w: 0.66, h: 0.462, rot: Math.sin(t * 1.6) * 0.025 });
  } else if (id === 5) {
    // Shot 5 (20.6..26.8): the letter: the man Mary called father was not her real father
    const shock = t >= 24.05;
    addChar(WHO_SARAH, 0.0, 0, -0.9, std(WHO_SARAH, shock ? "shock" : "pained", { prop: "cert", wave: q(Math.sin(t * 1.4), 10) }), 0.86);
    if (t >= 22.9 && t < 24.07) {
      const mk = q(clamp01((t - 23.5) / 0.5), 10);
      out.fx.push({ key: `fx|letter|${mk}`, cw: 400, ch: 520, draw: (p) => fxLetter(p, mk), x: 0.0, y: 1.38, z: -0.4, w: 0.6, h: 0.78, rot: 0.02 });
    }
    badge("notreal", "NOT HER", "REAL FATHER", "#e23b3b", "#ffffff", 0.0, 2.3, -0.4, 24.05, 26.8, 0.85);
  } else if (id === 6) {
    // Shot 6 (26.8..31.7): summer 1951, Mary meets a soldier named Thomas
    addChar(WHO_MARY, -0.45, 0, -0.8, std(WHO_MARY, t >= 28.99 ? "grin" : "smile_closed", { look: 1, facing: 1 }), 0.84);
    if (t >= 28.99) {
      const u = smooth(clamp01((t - 28.99) / 1.3));
      addChar(WHO_THOMAS, lerp(2.3, 0.45, u), 0, -0.8, std(WHO_THOMAS, "smile", { mode: u < 0.98 ? "march" : "stand", phase: q(t * 2.0, 20), look: -1, facing: -1, lift: 50 }), 0.86);
      hearts("meet", 0.0, 2.0, -0.4, 0.5, 29.8, 31.7);
    }
    badge("summer", "SUMMER 1951", "A MEADOW. A SMILE.", "#ffd43b", INK, 0.0, 2.35, -0.5, 26.83, 28.95, 0.9);
    badge("thomas", "A SOLDIER", "NAMED THOMAS", "#5a6b3a", "#ffffff", 0.0, 2.35, -0.5, 28.99, 31.7, 0.8);
  } else if (id === 7) {
    // Shot 7 (31.7..35.4): he left for the war and never came back
    const gone = t >= 33.0;
    addChar(WHO_MARY, -0.7, 0, -1.2, std(WHO_MARY, "pained", { look: 1, facing: 1, ...(gone ? {} : { wave: q(Math.sin(t * 6.0), 10) }) }), 0.84);
    if (!gone) addChar(WHO_THOMAS, 0.9, 0, -1.6, std(WHO_THOMAS, "smile", { look: -1, facing: -1, wave: q(Math.sin(t * 6.0 + 1), 10) }), 0.86);
    badge("war", "OFF TO THE WAR", "1951", "#5a6b3a", "#ffffff", -0.5, 2.35, -1.0, 31.95, 33.0, 0.85);
    badge("never", "NEVER CAME BACK", "NOT EVER", "#7a1f2e", "#ffffff", -0.5, 2.35, -1.0, 33.0, 35.4, 0.9);
  } else if (id === 8) {
    // Shot 8 (35.4..39.0): Daniel knew the truth and married Mary anyway
    if (t < 37.15) {
      addChar(WHO_DANIEL, 0.0, 0, -0.8, std(WHO_DANIEL, "stern"), 0.86);
      badge("knew", "DANIEL KNEW", "THE TRUTH", "#3a8fdb", "#ffffff", 0.0, 2.3, -0.4, 35.43, 37.15, 0.8);
    } else {
      addChar(WHO_DANIEL, -0.45, 0, -0.9, std(WHO_DANIEL, "smile_closed", { look: 1, facing: 1 }), 0.86);
      addChar(WHO_MARY, 0.45, 0, -0.9, std(WHO_MARY, "smile", { look: -1, facing: -1 }), 0.84);
      badge("married", "MARRIED HER", "ANYWAY", "#ffd43b", INK, 0.0, 2.55, -0.6, 37.15, 39.0, 0.85);
      hearts("wed", 0.0, 2.0, -0.6, 0.5, 37.6, 39.0);
    }
  } else if (id === 9) {
    // Shot 9 (39.0..44.0): raised her daughter as his own; asked that no one ever speak of it
    const shh = t >= 40.53;
    addChar(WHO_DANIEL, -0.6, 0, -0.8, std(WHO_DANIEL, shh ? "stern" : "smile_closed", { look: 1, facing: 1 }), 0.86);
    addChar(WHO_MARY, 0.0, 0, -0.8, std(WHO_MARY, "smile", { look: 0, facing: 0 }), 0.84);
    addChar(WHO_GIRL, 0.55, 0, -0.8, std(WHO_GIRL, "grin", { look: -1, facing: -1, wave: q(Math.sin(t * 3.0), 10) }), 0.42);
    badge("daughter", "HER DAUGHTER.", "HIS OWN.", "#2ecc71", "#ffffff", 0.0, 2.3, -0.4, 39.05, 40.5, 0.85);
    badge("shh", "SHHH...", "NO ONE EVER SPEAKS OF IT", "#4a4a5a", "#ffffff", -0.5, 2.3, -0.4, 40.53, 44.0, 0.95);
  } else if (id === 10) {
    // Shot 10 (44.0..49.55): Sarah at the kitchen table with the letter
    addChar(WHO_SARAH, -0.2, 0.36, -1.95, std(WHO_SARAH, t < 47.11 ? "pained" : "relief", { mode: "sit", prop: "yellowEnv", look: 0, facing: 0 }), 0.86, false);
    if (t >= 44.03) {
      const s = easeOut(clamp01((t - 44.03) / 0.3));
      out.fx.push({ key: "fx|letter|0", cw: 400, ch: 520, draw: (p) => fxLetter(p, 0), x: 0.25, y: 0.79, z: -1.3, w: 0.26 * s, h: 0.338 * s, flat: true, rot: 0.2 });
    }
    badge("kitchen", "THE KITCHEN TABLE", "THE LETTER IN HER HANDS", "#ffffff", INK, 0.0, 2.2, -1.4, 44.03, 47.11, 1.0);
    badge("grandpa", "HER QUIET", "GRANDFATHER", "#ffd43b", INK, 0.0, 2.2, -1.4, 47.11, 49.55, 0.8);
  } else if (id === 11) {
    // Shot 11 (49.55..54.4): He had not hidden a lie. He had kept a promise.
    addChar(WHO_SARAH, -0.2, 0.36, -1.95, std(WHO_SARAH, "relief", { mode: "sit", prop: "yellowEnv", look: 0, facing: 0 }), 0.86, false);
    if (t >= 50.5) {
      out.fx.push({ key: "fx|burst|mem", cw: 500, ch: 500, draw: (p) => fxBurst(p, 0.5, "#ffe9a8", 12, 40, 235), x: 0.9, y: 1.4, z: -3.0, w: 1.9, h: 1.9 });
      addChar(WHO_DANIEL_O, 0.9, 0, -2.6, std(WHO_DANIEL_O, "smile_closed", { look: -1, facing: -1 }), 0.86);
    }
    badge("nolie", "NOT A LIE", "NOT HIDDEN", "#3a8fdb", "#ffffff", 0.1, 2.25, -1.6, 49.57, 52.6, 0.8);
    badge("promise", "A PROMISE", "KEPT", "#ffd43b", INK, 0.1, 2.25, -1.6, 52.67, 54.4, 0.8);
    hearts("promise", 0.7, 2.0, -2.4, 0.5, 52.9, 54.4);
  } else {
    // Shot 12 (54.4..59.45): some truths wait forty years because love needs time
    addChar(WHO_SARAH, -0.2, 0.36, -1.95, std(WHO_SARAH, "smile", { mode: "sit", prop: "yellowEnv", look: 0, facing: 0 }), 0.86, false);
    out.fx.push({ key: "fx|letter|0", cw: 400, ch: 520, draw: (p) => fxLetter(p, 0), x: 0.25, y: 0.79, z: -1.3, w: 0.26, h: 0.338, flat: true, rot: 0.2 });
    badge("love", "LOVE NEEDS TIME", "SOME TRUTHS WAIT FORTY YEARS", "#ffffff", INK, 0.0, 2.55, -1.6, 54.55, 59.5, 1.1);
    hearts("final", -0.2, 2.0, -1.7, 0.6, 55.0, 59.5);
  }

  return out;
};
