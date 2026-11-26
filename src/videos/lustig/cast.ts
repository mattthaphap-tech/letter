// 2D Character Cast & Cartoon Effect Cards for "The Man Who Sold the Eiffel Tower" (Lustig, Poisson, dealers, police, comic props).
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
  LUSTIG_OUTFIT, POISSON_OUTFIT, DEALER_A, DEALER_B, DEALER_C, POLICE_OUTFIT, Expr,
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

/** Fake government ID card (400 x 250) */
const fxIdCard = (p: Pen) => {
  const g = p.g;
  g.lineJoin = "round"; g.lineCap = "round";
  g.fillStyle = "#f4efe2"; g.strokeStyle = INK; g.lineWidth = 8;
  g.beginPath(); g.roundRect(4, 4, 392, 242, 14); g.fill(); g.stroke();
  g.fillStyle = "#14264f"; g.fillRect(12, 12, 376, 56);
  g.fillStyle = "#ffd43b"; g.textAlign = "center"; g.font = "900 30px 'Segoe UI', Arial, sans-serif";
  g.fillText("GOVERNMENT OFFICIAL", 200, 52);
  // portrait: a man in a top hat
  g.fillStyle = "#cfe3f2"; g.fillRect(28, 86, 110, 120); g.strokeRect(28, 86, 110, 120);
  g.fillStyle = "#fcfaf5"; g.beginPath(); g.arc(83, 150, 28, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = "#2d2d3f"; g.fillRect(63, 108, 40, 26); g.fillRect(55, 130, 56, 8);
  g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(70, 158); g.quadraticCurveTo(83, 168, 96, 158); g.stroke();
  // lines of text
  g.strokeStyle = "#8a8a8a"; g.lineWidth = 6;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(160, 100 + i * 28); g.lineTo(370 - i * 24, 100 + i * 28); g.stroke(); }
  // wobbly red seal
  g.fillStyle = "rgba(226,59,59,0.85)"; g.beginPath(); g.arc(326, 188, 32, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ffffff"; g.font = "900 20px 'Segoe UI', Arial, sans-serif"; g.fillText("TOTALLY", 326, 186); g.fillText("REAL", 326, 208);
};

/** Handcuffs (320 x 200) */
const fxCuffs = (p: Pen) => {
  const g = p.g;
  g.lineJoin = "round"; g.lineCap = "round";
  g.strokeStyle = INK; g.fillStyle = "#c9ced6";
  for (const cx of [90, 230]) {
    g.lineWidth = 34; g.strokeStyle = INK; g.beginPath(); g.arc(cx, 100, 52, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 20; g.strokeStyle = "#d5dae2"; g.beginPath(); g.arc(cx, 100, 52, 0, Math.PI * 2); g.stroke();
  }
  g.lineWidth = 22; g.strokeStyle = INK; g.beginPath(); g.moveTo(140, 100); g.lineTo(180, 100); g.stroke();
  g.lineWidth = 10; g.strokeStyle = "#d5dae2"; g.beginPath(); g.moveTo(140, 100); g.lineTo(180, 100); g.stroke();
};

/** Sale contract for the Eiffel Tower with a red APPROVED stamp that slams in (400 x 500) */
const fxContract = (p: Pen, stamp: number) => {
  const g = p.g;
  g.lineJoin = "round"; g.lineCap = "round";
  g.fillStyle = "#fbf6e6"; g.strokeStyle = INK; g.lineWidth = 8;
  g.beginPath(); g.roundRect(4, 4, 392, 492, 12); g.fill(); g.stroke();
  g.fillStyle = INK; g.textAlign = "center"; g.font = "900 34px 'Segoe UI', Arial, sans-serif";
  g.fillText("SALE CONTRACT", 200, 66);
  g.font = "700 26px 'Segoe UI', Arial, sans-serif"; g.fillStyle = "#3a3a55";
  g.fillText("ITEM: THE EIFFEL TOWER", 200, 112);
  g.strokeStyle = "#b9b6aa"; g.lineWidth = 6;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(44, 150 + i * 34); g.lineTo(356 - (i === 5 ? 120 : 0), 150 + i * 34); g.stroke(); }
  g.strokeStyle = "#2b4fb0"; g.lineWidth = 5; g.beginPath(); g.moveTo(60, 440); g.quadraticCurveTo(100, 400, 130, 440); g.quadraticCurveTo(160, 470, 220, 430); g.stroke();
  if (stamp > 0.01) {
    g.save(); g.translate(250, 330); g.rotate(-0.28); const s = 0.8 + 0.2 * stamp; g.scale(s, s); g.globalAlpha = Math.min(1, stamp * 1.4);
    g.strokeStyle = "#e23b3b"; g.lineWidth = 12; g.strokeRect(-130, -48, 260, 96);
    g.fillStyle = "#e23b3b"; g.font = "900 62px 'Segoe UI', Arial, sans-serif"; g.fillText("OFFICIAL", 0, 22);
    g.restore();
  }
};

/** Fat envelope with cash sticking out (400 x 300) */
const fxEnvelope = (p: Pen) => {
  const g = p.g;
  g.lineJoin = "round"; g.lineCap = "round";
  g.strokeStyle = INK; g.lineWidth = 8;
  for (let i = 0; i < 3; i++) {
    g.fillStyle = "#6bcf7a"; g.beginPath(); g.roundRect(60 + i * 56, 20 + (i % 2) * 14, 130, 90, 8); g.fill(); g.stroke();
    g.fillStyle = "#3c9a4d"; g.beginPath(); g.arc(125 + i * 56, 65 + (i % 2) * 14, 22, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = "#f4e9c8"; g.beginPath(); g.roundRect(24, 100, 352, 176, 12); g.fill(); g.stroke();
  g.fillStyle = "#e7d9a8"; g.beginPath(); g.moveTo(24, 100); g.lineTo(200, 200); g.lineTo(376, 100); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#2e9a4d"; g.textAlign = "center"; g.font = "900 70px 'Segoe UI', Arial, sans-serif"; g.fillText("$$$", 200, 258);
};

/** Counterfeit banknote with a big FAKE watermark (480 x 240) */
const fxFakeBill = (p: Pen) => {
  const g = p.g;
  g.lineJoin = "round"; g.lineCap = "round";
  g.fillStyle = "#8fd99a"; g.strokeStyle = INK; g.lineWidth = 8;
  g.beginPath(); g.roundRect(4, 4, 472, 232, 12); g.fill(); g.stroke();
  g.strokeStyle = "#3c9a4d"; g.lineWidth = 5; g.strokeRect(22, 22, 436, 196);
  g.fillStyle = "#3c9a4d"; g.beginPath(); g.arc(240, 120, 60, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ffffff"; g.textAlign = "center"; g.font = "900 64px 'Segoe UI', Arial, sans-serif"; g.fillText("$", 240, 142);
  g.font = "900 34px 'Segoe UI', Arial, sans-serif"; g.fillStyle = "#2b6b3f"; g.fillText("100", 70, 70); g.fillText("100", 410, 205);
  g.save(); g.translate(240, 124); g.rotate(-0.3); g.strokeStyle = "#e23b3b"; g.lineWidth = 12; g.strokeRect(-150, -48, 300, 96);
  g.fillStyle = "#e23b3b"; g.font = "900 84px 'Segoe UI', Arial, sans-serif"; g.fillText("FAKE", 0, 28); g.restore();
};

// ---------------- Character Roster ----------------
const WHO_LUSTIG: Who = { i: 1, o: LUSTIG_OUTFIT, okey: "lustig" };
const WHO_POISSON: Who = { i: 2, o: POISSON_OUTFIT, okey: "poisson" };
const WHO_DA: Who = { i: 3, o: DEALER_A, okey: "dealerA" };
const WHO_DB: Who = { i: 4, o: DEALER_B, okey: "dealerB" };
const WHO_DC: Who = { i: 5, o: DEALER_C, okey: "dealerC" };
const WHO_POL1: Who = { i: 6, o: POLICE_OUTFIT, okey: "police1" };
const WHO_POL2: Who = { i: 7, o: POLICE_OUTFIT, okey: "police2" };

// ---------------- Stage Characters & 2D Effects Across All 10 Shots ----------------
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
    const s = easeOut(clamp01((t - t0) / 0.18));
    out.fx.push({
      key: `fx|badge|${key}`, cw: 560, ch: 260,
      draw: (p) => fxBadge(p, text, sub, bg, fg),
      x, y: y + Math.sin(t * 3.6) * 0.03, z, w: w * s, h: w * s * 0.4615,
    });
  };

  /** extra cast in the dealers' line-up */
  const dealer = (who: Who, x: number, ex: Expr, extra: Partial<FrontOpts> = {}) =>
    addChar(who, x, 0, -0.7, { mode: "stand", phase: q(t * 0.9 + x, 20), expr: ex, blink: lidAt(t, who.i), tilt: liveTilt(t, who.i, 2.0), headTilt: liveHead(t, who.i, 3.0), look: 0, facing: 0, ...extra }, 0.84);

  if (id === 1) {
    // Shot 1 (0..3.0): "He sold the Eiffel Tower. Twice."
    addChar(WHO_LUSTIG, 0.45, hopY(t, 1.64, 0.4, 0.12), -0.7, {
      mode: "stand", phase: q(t * 1.0, 20), expr: t < 1.64 ? "smile_closed" : "grin", blink: lidAt(t, 1, [1.64]),
      tilt: liveTilt(t, 1, 2.0), headTilt: liveHead(t, 1, 3.0), look: -1, facing: 0,
    }, 0.86);
    badge("sold", "SOLD!", "THE EIFFEL TOWER", "#e23b3b", "#ffffff", -0.15, 2.1, -0.5, 0.0, 1.64, 0.95);
    badge("twice", "TWICE.", "SAME TOWER, NEW BUYER", "#ffd43b", INK, 0.2, 2.1, -0.4, 1.64, 3.0, 0.8);
  } else if (id === 2) {
    // Shot 2 (3.0..10.2): arrives in Paris, May 1925, pretending to be a government official
    const walkU = clamp01((t - 3.16) / 3.8);
    const marching = walkU < 0.98;
    addChar(WHO_LUSTIG, lerp(-2.2, 0.0, smooth(walkU)), 0, -0.7, {
      mode: marching ? "march" : "stand", phase: q(t * 2.2, 20), expr: t < 8.0 ? "smile_closed" : "grin", blink: lidAt(t, 1, [8.0]),
      tilt: 2 + liveTilt(t, 1, 1.6), headTilt: liveHead(t, 1, 3.0), look: 1, facing: 1, lift: 60,
      prop: t < 7.98 ? "suitcase" : "cert", ...(t >= 7.98 ? { wave: q(Math.sin(t * 3.0), 10) } : {}),
    }, 0.86);
    badge("paris", "PARIS, MAY 1925", "A CON MAN ARRIVES", "#3a8fdb", "#ffffff", -0.3, 2.35, -0.5, 3.2, 7.9, 0.85);
    if (t >= 8.0) {
      const s = easeOut(clamp01((t - 8.0) / 0.25));
      out.fx.push({ key: "fx|idcard", cw: 400, ch: 250, draw: (p) => fxIdCard(p), x: 0.6, y: 1.2, z: -0.35, w: 0.46 * s, h: 0.2875 * s, rot: -0.08 });
    }
    badge("fakeoff", "FAKE OFFICIAL", "(HE'S NOT)", "#e23b3b", "#ffffff", 0.3, 2.15, -0.4, 8.4, 10.2, 0.72);
  } else if (id === 3) {
    // Shot 3 (10.2..15.5): tour of the tower in a "government car", acting like he owns it
    addChar(WHO_LUSTIG, -0.45, 0, -0.8, {
      mode: "stand", phase: q(t * 1.0, 20), expr: "grin", blink: lidAt(t, 1, [13.7]),
      tilt: liveTilt(t, 1, 2.0) + (t >= 13.7 ? -3 : 0), headTilt: liveHead(t, 1, 3.0), prop: "point_up", look: 1, facing: 1,
    }, 0.86);
    dealer(WHO_DA, 0.05, "smile", { look: -1, facing: -1 });
    dealer(WHO_DB, 0.5, "relief", { look: -1, facing: -1 });
    dealer(WHO_DC, 0.95, "smile", { look: -1, facing: -1 });
    badge("car", "GOVERNMENT CAR", "VERY OFFICIAL", "#2ecc71", "#ffffff", 0.25, 2.3, -0.5, 10.64, 13.7, 0.85);
    badge("owner", "ACTING LIKE", "THE OWNER", "#ffd43b", INK, 0.2, 2.3, -0.5, 13.7, 15.5, 0.8);
  } else if (id === 4) {
    // Shot 4 (15.5..23.0): picks the most ambitious dealer, André Poisson, and asks for a bribe
    const bribe = t >= 20.16;
    addChar(WHO_LUSTIG, -1.1, 0, -0.7, {
      mode: "stand", phase: q(t * 1.0, 20), expr: t < 17.7 ? "smile_closed" : "grin", blink: lidAt(t, 1, [17.7, 20.16]),
      tilt: liveTilt(t, 1, 2.0), headTilt: liveHead(t, 1, 3.0), prop: "reach", wave: bribe ? q(Math.sin(t * 6.0), 10) : 0, look: 1, facing: 1,
    }, 0.86, true, false, true);
    dealer(WHO_DA, -0.4, "neutral", { look: 0, facing: 0 });
    addChar(WHO_POISSON, 0.15, 0, -0.7, {
      mode: "stand", phase: q(t * 1.1, 20), expr: bribe ? "smile" : "nervous", blink: lidAt(t, 2, [17.7, 20.16]),
      tilt: liveTilt(t, 2, 2.4), headTilt: liveHead(t, 2, 3.6), prop: bribe ? "envelope" : "suitcase", look: -1, facing: -1,
    }, 0.84);
    dealer(WHO_DB, 0.7, "neutral", { look: 0, facing: 0 });
    dealer(WHO_DC, 1.25, "neutral", { look: 0, facing: 0 });
    badge("poisson", "ANDRE POISSON", "NEWCOMER. VERY AMBITIOUS.", "#ffffff", INK, 0.15, 2.35, -0.4, 17.7, 20.1, 0.8);
    badge("bribe", "BRIBE ON TOP", "OF THE PRICE", "#2ecc71", "#ffffff", -0.45, 2.25, -0.4, 20.4, 23.0, 0.78);
  } else if (id === 5) {
    // Shot 5 (23.0..32.0): the bribe makes it feel real; everyone believed the rusting tower cost too much to keep
    if (t < 27.62) {
      out.fx.push({ key: "fx|envelope", cw: 400, ch: 300, draw: (p) => fxEnvelope(p), x: -0.34, y: 1.32, z: -0.35, w: 0.55, h: 0.4125, rot: Math.sin(t * 2.0) * 0.03 });
      if (t >= 24.92) {
        const stp = q(easeOut(clamp01((t - 25.5) / 0.2)), 20);
        const s = easeOut(clamp01((t - 24.92) / 0.2));
        out.fx.push({ key: `fx|contract|${stp}`, cw: 400, ch: 500, draw: (p) => fxContract(p, stp), x: 0.14, y: 1.4, z: -0.4, w: 0.62 * s, h: 0.775 * s, rot: 0.03 + Math.sin(t * 2.2) * 0.02 });
      }
    } else {
      dealer(WHO_POISSON, 0.3, "relief", { look: -1, facing: -1, lift: 60 });
      badge("rust", "RUSTING...", "TOO COSTLY TO KEEP", "#e23b3b", "#ffffff", 0.0, 2.9, -1.0, 27.62, 32.0, 1.2);
      if (t >= 28.4) {
        const ph = q((t - 28.4) * 1.4, 20);
        out.fx.push({ key: `fx|money|s5|${ph}`, cw: 520, ch: 520, draw: (p) => fxMoneyFly(p, ph), x: 0.0, y: 4.2, z: -5.0, w: 2.4, h: 2.4 });
      }
    }
  } else if (id === 6) {
    // Shot 6 (32.0..37.5): Poisson paid; Lustig is on a train to Vienna
    addChar(WHO_LUSTIG, 0.25, hopY(t, 32.02, 0.42, 0.14), -1.6, {
      mode: "stand", phase: q(t * 1.0, 20), expr: "grin", blink: lidAt(t, 1, [32.02]),
      tilt: liveTilt(t, 1, 2.0), headTilt: liveHead(t, 1, 3.0), wave: q(Math.sin(t * 7.0), 10), look: 0, facing: 0,
    }, 0.86);
    badge("paid", "PAID IN FULL", "EVERYTHING. CASH.", "#2ecc71", "#ffffff", -0.6, 2.35, -1.0, 32.02, 34.4, 0.85);
    badge("vienna", "TRAIN TO VIENNA", "BEFORE ANYONE LOOKS", "#ffd43b", INK, -0.5, 2.35, -1.0, 34.4, 37.5, 0.9);
    if (t >= 32.02 && t < 34.0) {
      const ph = q((t - 32.02) * 1.5, 20);
      out.fx.push({ key: `fx|money|s6|${ph}`, cw: 520, ch: 520, draw: (p) => fxMoneyFly(p, ph), x: -1.1, y: 1.5, z: -1.2, w: 1.1, h: 1.1 });
    }
  } else if (id === 7) {
    // Shot 7 (37.5..42.0): Poisson never called the police, too embarrassed
    addChar(WHO_POISSON, 0.0, 0, -0.7, {
      mode: "stand", phase: q(t * 0.9, 20), expr: t < 40.24 ? "nervous" : "pained", blink: lidAt(t, 2, [40.24]),
      tilt: -3 + liveTilt(t, 2, 2.0), headTilt: -5 + liveHead(t, 2, 3.0), prop: "phone", wave: q(Math.sin(t * 2.4), 10), look: 0, facing: 0,
    }, 0.86);
    badge("police", "NEVER CALLED", "THE POLICE", "#e23b3b", "#ffffff", 0.0, 2.3, -0.4, 37.74, 40.24, 0.85);
    badge("embar", "TOO EMBARRASSED", "(IT'S TRUE)", "#ff8fb8", INK, 0.0, 2.3, -0.4, 40.24, 42.0, 0.9);
  } else if (id === 8) {
    // Shot 8 (42.0..46.2): a month later Lustig is back with new buyers
    const wu = clamp01((t - 42.4) / 2.4);
    const mode = wu < 0.98 ? "march" : "stand";
    const px = lerp(-2.2, -0.35, smooth(wu));
    addChar(WHO_LUSTIG, px, 0, -0.7, {
      mode, phase: q(t * 2.2, 20), expr: "grin", blink: lidAt(t, 1, [44.8]),
      tilt: 2 + liveTilt(t, 1, 1.6), headTilt: liveHead(t, 1, 3.0), look: 1, facing: 1, lift: 60,
    }, 0.86);
    dealer(WHO_DB, px + 0.6, "smile", { mode, phase: q(t * 2.2 + 0.2, 20), look: 1, facing: 1, lift: 60 });
    dealer(WHO_DC, px + 1.15, "relief", { mode, phase: q(t * 2.2 + 0.4, 20), look: 1, facing: 1, lift: 60 });
    badge("month", "ONE MONTH LATER", "(SAME CITY, SAME TOWER)", "#ffd43b", INK, 0.0, 2.3, -0.4, 42.0, 44.6, 1.0);
    badge("again", "FOR SALE.", "AGAIN.", "#e23b3b", "#ffffff", 0.0, 2.3, -0.4, 44.8, 46.2, 0.8);
  } else if (id === 9) {
    // Shot 9 (46.2..50.2): years later the police catch him, for fake money
    const cuffed = t >= 47.2;
    addChar(WHO_POL1, -0.75, 0, -0.7, {
      mode: "stand", phase: q(t * 1.0, 20), expr: "stern", blink: lidAt(t, 6), tilt: liveTilt(t, 6, 2.0), headTilt: liveHead(t, 6, 3.0),
      prop: "reach", wave: q(Math.sin(t * 5.0), 10), look: 1, facing: 1,
    }, 0.86, true, false, true);
    addChar(WHO_LUSTIG, 0.0, 0, -0.7, {
      mode: "stand", phase: q(t * 1.0, 20), expr: cuffed ? "pained" : "shock", blink: lidAt(t, 1, [47.2]),
      tilt: liveTilt(t, 1, 3.0), headTilt: liveHead(t, 1, 4.0), look: 0, facing: 0,
    }, 0.86);
    addChar(WHO_POL2, 0.75, 0, -0.7, {
      mode: "stand", phase: q(t * 1.0 + 0.3, 20), expr: "stern", blink: lidAt(t, 7), tilt: liveTilt(t, 7, 2.0), headTilt: liveHead(t, 7, 3.0),
      prop: "reach", wave: q(Math.sin(t * 5.0 + 1), 10), look: -1, facing: -1,
    }, 0.86);
    badge("years", "YEARS LATER", "THE POLICE CATCH HIM", "#3a8fdb", "#ffffff", 0.0, 2.35, -0.4, 46.34, 47.8, 0.9);
    if (cuffed) {
      const s = easeOut(clamp01((t - 47.2) / 0.2));
      out.fx.push({ key: "fx|cuffs", cw: 320, ch: 200, draw: (p) => fxCuffs(p), x: 0.0, y: 0.82, z: -0.3, w: 0.36 * s, h: 0.225 * s, rot: 0.1 });
    }
    badge("fake", "FAKE MONEY", "THAT'S WHAT DID IT", "#e23b3b", "#ffffff", 0.0, 2.35, -0.4, 47.8, 50.2, 0.85);
    if (t >= 49.4) {
      const s = easeOut(clamp01((t - 49.4) / 0.2));
      out.fx.push({ key: "fx|fakebill", cw: 480, ch: 240, draw: (p) => fxFakeBill(p), x: 0.0, y: 1.4, z: -0.3, w: 0.62 * s, h: 0.31 * s, rot: -0.05 });
    }
  } else {
    // Shot 10 (50.2..51.9): in a cell: never caught for the tower
    addChar(WHO_LUSTIG, 0.0, 0, -0.9, {
      mode: "stand", phase: q(t * 0.9, 20), expr: t < 51.3 ? "smile_closed" : "grin", blink: lidAt(t, 1, [51.3]),
      tilt: liveTilt(t, 1, 2.0), headTilt: liveHead(t, 1, 3.0), look: 0, facing: 0,
    }, 0.86);
    badge("never", "NEVER FOR", "THE TOWER", "#ffd43b", INK, 0.0, 2.5, -0.5, 50.32, 51.93, 0.9);
    if (t >= 51.3) {
      const sp = q((t - 51.3) * 1.5, 20);
      out.fx.push({ key: `fx|stars|s10|${sp}`, cw: 420, ch: 220, draw: (p) => fxStars(p, sp), x: 0.0, y: 2.1, z: -0.4, w: 0.8, h: 0.42 });
    }
  }

  return out;
};
