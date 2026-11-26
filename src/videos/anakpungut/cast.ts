// 2D Character Cast & Cartoon Effect Cards for "Anak Pungut Sultan" (Mark, Elon, thought bubble, photo cards).
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
  MARK_OUTFIT, MARK_GUARD_OUTFIT, ELON_OUTFIT,
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

/** Thought bubble with a sports car, a yacht and $$$ (600 x 480) */
const fxThought = (p: Pen, phase: number) => {
  const g = p.g;
  g.lineJoin = "round"; g.lineCap = "round";
  // cloud
  g.fillStyle = "#ffffff"; g.strokeStyle = INK; g.lineWidth = 10;
  const blobs: [number, number, number][] = [[110, 190, 90], [220, 120, 105], [350, 105, 110], [480, 150, 95], [500, 250, 85], [380, 300, 100], [230, 300, 100], [120, 280, 80]];
  g.beginPath();
  for (const [cx, cy, r] of blobs) { g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, Math.PI * 2); }
  g.fill(); g.stroke();
  g.beginPath(); for (const [cx, cy, r] of blobs) { g.moveTo(cx + r - 14, cy); g.arc(cx, cy, r - 14, 0, Math.PI * 2); } g.fillStyle = "#ffffff"; g.fill();
  // tail bubbles
  g.fillStyle = "#ffffff"; g.lineWidth = 8;
  g.beginPath(); g.arc(120, 410, 30, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.arc(70, 455, 16, 0, Math.PI * 2); g.fill(); g.stroke();
  // sports car
  g.save(); g.translate(170, 215); g.lineWidth = 8;
  g.fillStyle = "#e23b3b"; g.beginPath(); g.moveTo(-110, 24); g.lineTo(-110, -6); g.quadraticCurveTo(-100, -22, -60, -26); g.lineTo(-30, -58); g.quadraticCurveTo(0, -70, 40, -58); g.lineTo(72, -28); g.quadraticCurveTo(112, -24, 116, 2); g.lineTo(116, 24); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#bfe6ff"; g.lineWidth = 5;
  g.beginPath(); g.moveTo(-24, -52); g.lineTo(-44, -28); g.lineTo(10, -28); g.lineTo(10, -56); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(22, -56); g.lineTo(22, -28); g.lineTo(66, -28); g.lineTo(40, -52); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#222"; g.lineWidth = 6;
  for (const wx of [-62, 70]) { g.beginPath(); g.arc(wx, 26, 24, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = "#ddd"; g.beginPath(); g.arc(wx, 26, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = "#222"; }
  g.restore();
  // yacht (bobbing)
  g.save(); g.translate(395, 205 + Math.sin(phase * 6) * 7); g.lineWidth = 7;
  g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(-100, 10); g.lineTo(100, 10); g.lineTo(74, 50); g.lineTo(-74, 50); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.roundRect(-56, -24, 92, 34, 6); g.fill(); g.stroke();
  g.fillStyle = "#8fd0f5"; g.lineWidth = 3;
  for (const wx of [-32, -8, 16]) { g.beginPath(); g.arc(wx, -8, 8, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.lineWidth = 6; g.beginPath(); g.moveTo(46, -24); g.lineTo(46, -74); g.stroke();
  g.fillStyle = "#e23b3b"; g.lineWidth = 5; g.beginPath(); g.moveTo(48, -74); g.lineTo(86, -34); g.lineTo(48, -34); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = "#3a8fdb"; g.lineWidth = 9; g.beginPath(); g.moveTo(-124, 56); for (let k = 0; k < 6; k++) g.quadraticCurveTo(-124 + 42 * k + 21, 38, -124 + 42 * (k + 1), 56); g.stroke();
  g.restore();
  // $$$
  g.fillStyle = "#3c9a4d"; g.strokeStyle = INK; g.lineWidth = 9; g.textAlign = "center";
  g.font = "900 110px 'Segoe UI', Arial, sans-serif";
  g.strokeText("$$$", 300, 345 + Math.sin(phase * 5) * 5); g.fillText("$$$", 300, 345 + Math.sin(phase * 5) * 5);
};

/** The old photo: Elon (suit, gold tie) holding baby Mark. Canvas 400 x 330 */
const fxPhotoFront = (p: Pen) => {
  const g = p.g;
  g.lineJoin = "round"; g.lineCap = "round";
  g.fillStyle = "#fdfbf4"; g.strokeStyle = INK; g.lineWidth = 8;
  g.beginPath(); g.roundRect(4, 4, 392, 322, 10); g.fill(); g.stroke();
  const gr = g.createLinearGradient(20, 20, 380, 270); gr.addColorStop(0, "#ffe3c2"); gr.addColorStop(1, "#ffc9a0");
  g.fillStyle = gr; g.fillRect(20, 20, 360, 250); g.lineWidth = 5; g.strokeRect(20, 20, 360, 250);
  g.fillStyle = "#ffffff";
  for (const [sx, sy] of [[60, 60], [340, 70], [330, 230], [70, 230]]) {
    g.beginPath(); g.moveTo(sx, sy - 12); g.lineTo(sx + 4, sy - 4); g.lineTo(sx + 12, sy); g.lineTo(sx + 4, sy + 4); g.lineTo(sx, sy + 12); g.lineTo(sx - 4, sy + 4); g.lineTo(sx - 12, sy); g.lineTo(sx - 4, sy - 4); g.closePath(); g.fill();
  }
  // suit
  g.fillStyle = "#1d2f5c"; g.lineWidth = 5;
  g.beginPath(); g.moveTo(62, 270); g.quadraticCurveTo(70, 178, 140, 172); g.quadraticCurveTo(210, 178, 218, 270); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#ffffff"; g.lineWidth = 3; g.beginPath(); g.moveTo(118, 176); g.lineTo(140, 214); g.lineTo(162, 176); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#d9a82b"; g.beginPath(); g.moveTo(134, 184); g.lineTo(146, 184); g.lineTo(150, 238); g.lineTo(140, 248); g.lineTo(130, 238); g.closePath(); g.fill(); g.stroke();
  // head + hair + face
  g.fillStyle = "#ffe2c2"; g.lineWidth = 5; g.beginPath(); g.arc(140, 120, 52, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = "#6a4326"; g.lineWidth = 4;
  g.beginPath(); g.moveTo(88, 114); g.quadraticCurveTo(86, 60, 140, 64); g.quadraticCurveTo(196, 60, 192, 114); g.quadraticCurveTo(176, 86, 140, 86); g.quadraticCurveTo(104, 86, 88, 114); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = INK; g.beginPath(); g.arc(122, 122, 5, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(158, 122, 5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(118, 142); g.quadraticCurveTo(140, 162, 164, 142); g.stroke();
  // arm + baby
  g.strokeStyle = INK; g.lineWidth = 30; g.beginPath(); g.moveTo(196, 224); g.quadraticCurveTo(236, 236, 270, 226); g.stroke();
  g.strokeStyle = "#1d2f5c"; g.lineWidth = 20; g.beginPath(); g.moveTo(196, 224); g.quadraticCurveTo(236, 236, 270, 226); g.stroke();
  g.fillStyle = "#ffd84a"; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.ellipse(248, 196, 36, 44, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = "#ffe2c2"; g.beginPath(); g.arc(248, 140, 36, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(232, 106); g.quadraticCurveTo(240, 90, 248, 104); g.quadraticCurveTo(256, 90, 264, 106); g.stroke();
  g.fillStyle = "#ffffff"; g.lineWidth = 3;
  for (const ex of [236, 260]) { g.beginPath(); g.arc(ex, 142, 7, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(ex + 1, 143, 3, 0, Math.PI * 2); g.fill(); g.fillStyle = "#ffffff"; }
  g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(240, 158); g.quadraticCurveTo(248, 168, 256, 158); g.stroke();
};

/** Back of the photo: handwritten orphanage note. Canvas 400 x 330 */
const fxPhotoBack = (p: Pen, glow: number) => {
  const g = p.g;
  g.lineJoin = "round"; g.lineCap = "round";
  g.fillStyle = "#efe3c2"; g.strokeStyle = INK; g.lineWidth = 8;
  g.beginPath(); g.roundRect(4, 4, 392, 322, 10); g.fill(); g.stroke();
  g.fillStyle = "rgba(217,199,155,0.6)"; g.beginPath(); g.ellipse(320, 270, 46, 30, 0, 0, Math.PI * 2); g.fill();
  const fam = "'Segoe Script', 'Comic Sans MS', 'Brush Script MT', cursive";
  g.textAlign = "center";
  g.fillStyle = "#2b2b55"; g.font = `italic 36px ${fam}`; g.fillText("Orphanage Opening", 200, 92);
  g.strokeStyle = "rgba(43,43,85,0.5)"; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 110); g.lineTo(340, 110); g.stroke();
  g.fillStyle = "#d62f2f"; g.font = `italic 42px ${fam}`; g.fillText("Adopted Child", 200, 192);
  g.font = `italic 58px ${fam}`; g.fillText("No. 47", 200, 254);
  g.strokeStyle = "#d62f2f"; g.lineWidth = 6 + glow * 3;
  g.beginPath(); g.ellipse(200, 216, 170 + glow * 8, 76 + glow * 6, 0, 0, Math.PI * 2); g.stroke();
};

// ---------------- Character Roster ----------------
const WHO_MARK: Who = { i: 1, o: MARK_OUTFIT, okey: "mark" };
const WHO_MARK_G: Who = { i: 1, o: MARK_GUARD_OUTFIT, okey: "markguard" };
const WHO_ELON: Who = { i: 2, o: ELON_OUTFIT, okey: "elon" };

// ---------------- Stage Characters & 2D Effects Across All 10 Shots ----------------
export const stage = (ws: WorldState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const { id, f, t } = ws;
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
  const badge = (key: string, text: string, sub: string, bg: string, fg: string, x: number, y: number, z: number, t0: number, t1: number, w = 0.66) => {
    if (t < t0 || t >= t1) return;
    const s = easeOut(clamp01((t - t0) / 0.18));
    out.fx.push({
      key: `fx|badge|${key}`, cw: 560, ch: 260,
      draw: (p) => fxBadge(p, text, sub, bg, fg),
      x, y: y + Math.sin(t * 3.6) * 0.03, z, w: w * s, h: w * s * 0.4615,
    });
  };

  if (id === 1) {
    // Shot 1 (0..8.5): "Mark, 25 years old, 147 job applications, 147 rejections."  Mark slumped on his bed.
    addChar(WHO_MARK, -0.78, 0.56, -1.9, {
      mode: "sit", phase: q(t * 0.8, 20), expr: t < 5.8 - LEAD ? "stern" : "pained", blink: lidAt(t, 1, [5.8]),
      tilt: liveTilt(t, 1, 2.0) + 4, headTilt: liveHead(t, 1, 3.0) + 6, look: 1, facing: 1,
    }, 0.84, false);
    badge("apps", "147 APPLICATIONS", "TO 147 COMPANIES", "#3a8fdb", "#ffffff", -0.55, 2.35, -1.4, 3.0, 5.4);
    badge("rej", "147 REJECTIONS", "AND COUNTING...", "#e23b3b", "#ffffff", -0.55, 2.35, -1.4, 5.79, 8.5);
  } else if (id === 2) {
    // Shot 2 (8.5..14.6): "Tonight, he has 2 dollars left and one packet of instant noodles."
    const chew = t >= 10 && Math.floor(t * 5) % 2 === 1;
    addChar(WHO_MARK, -0.78, 0.56, -1.9, {
      mode: "sit", phase: q(t * 0.8, 20), expr: chew ? "whistle" : "stern", blink: lidAt(t, 1),
      tilt: liveTilt(t, 1, 2.0) + 3, headTilt: liveHead(t, 1, 3.0) + 4, prop: "bowl", wave: q(Math.sin(t * 3.2), 10), look: 1, facing: 1,
    }, 0.84, false);
    badge("two", "$2 LEFT", "AND 1 PACK OF NOODLES", "#ffd43b", INK, -0.55, 2.35, -1.4, 9.6, 14.6);
  } else if (id === 3) {
    // Shot 3 (14.6..19.5): "Desperate, he digs through an old box and a photo falls out."
    const dig = Math.sin(t * 7) * 3.5;
    addChar(WHO_MARK, 0.35, 0, -1.55, {
      mode: "sit", phase: q(t * 0.8, 20), expr: t < 17.2 ? "nervous" : "shock", blink: lidAt(t, 1, [17.2]),
      tilt: (t < 17.2 ? dig : -3) + 2, headTilt: liveHead(t, 1, t < 17.2 ? 6 : 2.5), look: t < 17.7 ? 0 : 1, facing: 0,
    }, 0.84, true);
    if (t >= 17.0 && t < 17.7) {
      const bt = q(clamp01((t - 17.0) / 0.7), 20);
      out.fx.push({ key: `fx|burst|s3|${bt}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, bt, "#fff3b0", 12, 36, 235), x: 0.35, y: 0.55, z: -0.8, w: 0.7, h: 0.7 });
    }
    if (t >= 17.2) {
      const apex = 17.75, land = 18.3;
      const x = 0.35 + 0.2 * clamp01((t - 17.2) / (land - 17.2));
      if (t < land) {
        const y = t < apex ? lerp(0.4, 1.35, easeOut((t - 17.2) / (apex - 17.2))) : lerp(1.35, 0.04, ((t - apex) / (land - apex)) ** 2);
        out.fx.push({ key: "fx|photoF", cw: 400, ch: 330, draw: (p) => fxPhotoFront(p), x, y, z: -0.8, w: 0.24, h: 0.198, rot: (t - 17.2) * 9 });
      } else {
        out.fx.push({ key: "fx|photoF", cw: 400, ch: 330, draw: (p) => fxPhotoFront(p), x: 0.55, y: 0.035, z: -0.85, w: 0.24, h: 0.198, flat: true, rot: 0.35 });
      }
    }
  } else if (id === 4) {
    // Shot 4 (19.5..27.2): the photo: little Mark in Elon's arms ("Mr. Elon, the richest man in the country")
    addChar(WHO_MARK, -0.62, 0, -0.9, {
      mode: "stand", phase: q(t * 1.0, 20), expr: t < 25.09 ? "smile" : "grin", blink: lidAt(t, 1, [23.56, 25.09]),
      tilt: liveTilt(t, 1, 2.4), headTilt: liveHead(t, 1, 3.6), prop: "photo", wave: q(Math.sin(t * 3.0), 10), look: 1, facing: 1,
    }, 0.84, true);
    out.fx.push({
      key: "fx|photoF", cw: 400, ch: 330, draw: (p) => fxPhotoFront(p),
      x: 0.05, y: 1.32, z: -0.4, w: 0.78, h: 0.643, rot: Math.sin(t * 2.0) * 0.03,
    });
    badge("littlemark", "LITTLE MARK", "THE BABY", "#ffffff", INK, 0.42, 1.98, -0.3, 20.21, 23.3, 0.5);
    badge("elon", "MR. ELON", "THE RICHEST MAN", "#2ecc71", "#ffffff", -0.25, 1.98, -0.3, 23.56, 27.2, 0.58);
    if (t >= 25.09) {
      const ph = q((t - 25.09) * 1.5, 20);
      out.fx.push({ key: `fx|money|s4|${ph}`, cw: 520, ch: 520, draw: (p) => fxMoneyFly(p, ph), x: 0.0, y: 1.5, z: -0.2, w: 1.0, h: 1.0 });
    }
  } else if (id === 5) {
    // Shot 5 (27.2..30.37): "Wait, is he my father?"  Shocked Mark + thought bubble (sports car, yacht, $$$)
    const hopM = hopY(t, 27.55, 0.40, 0.14);
    out.fx.push({
      key: `fx|burst|s5|${q(((t - 27.2) % 0.9) / 0.9, 20)}`, cw: 500, ch: 500,
      draw: (p) => fxBurst(p, q(((t - 27.2) % 0.9) / 0.9, 20), "#ffd43b", 14, 40, 235), x: 0.0, y: 1.45, z: -1.2, w: 2.0, h: 2.0,
    });
    addChar(WHO_MARK, 0.0, hopM, -0.7, {
      mode: "stand", phase: q(t * 1.2, 20), expr: "shock", blink: lidAt(t, 1, [27.2]),
      tilt: liveTilt(t, 1, 3.0), headTilt: liveHead(t, 1, 4.0), look: 0, facing: 0,
    }, 0.88);
    if (t >= 29.0) {
      const s = easeOut(clamp01((t - 29.0) / 0.3)), ph = q((t - 29.0) * 1.2, 20);
      out.fx.push({ key: `fx|thought|${ph}`, cw: 600, ch: 480, draw: (p) => fxThought(p, ph), x: 0.3, y: 2.25, z: -0.9, w: 1.0 * s, h: 0.8 * s });
    }
  } else if (id === 6) {
    // Shot 6 (30.37..32.5): "Mark runs straight to the mansion."
    const walkU = clamp01((t - 30.37) / 2.0);
    addChar(WHO_MARK, lerp(-2.0, -0.1, smooth(walkU)), 0, -0.6, {
      mode: walkU < 0.97 ? "march" : "stand", phase: q(t * 2.6, 20), expr: "grin", blink: lidAt(t, 1),
      tilt: 4 + liveTilt(t, 1, 2.0), headTilt: liveHead(t, 1, 3.0), look: 1, facing: 1, lift: 70,
    }, 0.86);
  } else if (id === 7) {
    // Shot 7 (32.5..34.8): "Dad, I'm home."  Mark cheers at the gate, Elon steps out of the mansion
    const hopM = hopY(t, 32.68, 0.42, 0.16);
    addChar(WHO_MARK, 0.0, hopM, -0.7, {
      mode: "stand", phase: q(t * 1.4, 20), expr: t < 33.4 ? "shock" : "grin", blink: lidAt(t, 1, [32.68, 33.4]),
      tilt: liveTilt(t, 1, 3.0), headTilt: liveHead(t, 1, 4.0), prop: "cheer", look: 0, facing: 0,
    }, 0.86);
    if (t >= 33.4) {
      const u = smooth(clamp01((t - 33.4) / 1.4));
      addChar(WHO_ELON, 0.0, 0, lerp(-6.4, -3.4, u), {
        mode: u < 0.98 ? "march" : "stand", phase: q(t * 1.6, 20), expr: "smile", blink: lidAt(t, 2), look: 0, facing: 0, lift: 50,
      }, 0.88);
    }
    badge("dad", "DAD!", "I'M HOME!", "#ffd43b", INK, 0.0, 2.2, -0.5, 32.68, 34.4, 0.9);
  } else if (id === 8) {
    // Shot 8 (34.8..42.5): Elon laughs and flips the photo: "Orphanage Opening. Adopted Child No. 47."
    const dazed = t >= 42.0;
    addChar(WHO_MARK, -0.55, 0, -0.6, {
      mode: "stand", phase: q(t * 1.0, 20), expr: dazed ? "dazed" : t < 36.4 ? "grin" : "nervous", blink: lidAt(t, 1, [36.4, 42.0]),
      tilt: liveTilt(t, 1, 2.4), headTilt: liveHead(t, 1, 3.6), look: 1, facing: 1,
    }, 0.84);
    const laugh = t < 38.2;
    addChar(WHO_ELON, 0.58, 0, -0.6, {
      mode: "stand", phase: q(t * 1.0, 20), expr: laugh ? "laugh" : "smile", blink: lidAt(t, 2, [38.2]),
      tilt: laugh ? liveTilt(t, 2, 5.0) : liveTilt(t, 2, 2.0), headTilt: liveHead(t, 2, 4.0), prop: "point_up", look: -1, facing: -1,
    }, 0.88);
    // the photo, held up, then flipped over
    const fp = clamp01((t - 38.2) / 0.7), grow = easeOut(clamp01((t - 38.2) / 1.2));
    const sx = Math.max(0.02, Math.abs(Math.cos(fp * Math.PI))), base = lerp(0.66, 0.92, grow);
    const ph = q(t >= 40.24 ? Math.abs(Math.sin((t - 40.24) * 6)) : 0, 10);
    out.fx.push({
      key: fp < 0.5 ? "fx|photoF" : `fx|photoB|${ph}`, cw: 400, ch: 330,
      draw: (p) => (fp < 0.5 ? fxPhotoFront(p) : fxPhotoBack(p, ph)),
      x: lerp(0.12, 0.05, grow), y: lerp(1.85, 1.95, grow), z: -0.35, w: base * sx, h: base * 0.8236, rot: 0.04 * Math.sin(t * 2.2),
    });
    if (t >= 42.0) {
      const bt = q(clamp01((t - 42.0) / 0.5), 20);
      out.fx.push({ key: `fx|burst|s8|${bt}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, bt, "#ff6b6b", 10, 30, 215), x: -0.5, y: 2.1, z: -0.4, w: 0.5, h: 0.5 });
    }
    badge("no47", "NO. 47", "ADOPTED CHILD", "#e23b3b", "#ffffff", 0.05, 2.62, -0.3, 40.24, 42.5, 0.6);
  } else if (id === 9) {
    // Shot 9 (42.5..49): "So, I'm adopted? Yes, but don't worry, we need a security guard."
    const pat = t >= 44.05 && t < 46.2 ? q(Math.sin((t - 44.05) * 18), 10) : 0;
    addChar(WHO_MARK, -0.5, 0, -0.6, {
      mode: "stand", phase: q(t * 0.9, 20), expr: t < 44.05 ? "dazed" : t < 46.2 ? "pained" : "nervous", blink: lidAt(t, 1, [44.05, 46.2]),
      tilt: -4 + liveTilt(t, 1, 2.0), headTilt: -6 + liveHead(t, 1, 3.0), look: 1, facing: 1,
    }, 0.84);
    const cap = t >= 46.2;
    addChar(WHO_ELON, 0.38, 0, -0.6, {
      mode: "stand", phase: q(t * 1.0, 20), expr: cap ? "grin" : "smile", blink: lidAt(t, 2, [46.2]),
      tilt: liveTilt(t, 2, 2.0), headTilt: liveHead(t, 2, 3.5), prop: cap ? "capHold" : "reach",
      ...(cap ? { wave: q(Math.sin(t * 4.0), 10) } : { wave: pat }), look: -1, facing: -1,
    }, 0.88);
    badge("guard", "GUARD NEEDED!", "APPLY NOW, MARK", "#ffd43b", INK, 0.2, 2.5, -0.3, 46.2, 49.0, 0.74);
  } else {
    // Shot 10 (49..52.27): "And just like that, Mark finally got a job."  Security guard Mark salutes at golden hour
    const hopA = hopY(t, 49.0, 0.42, 0.16), hopB = hopY(t, 50.47, 0.40, 0.14);
    addChar(WHO_MARK_G, 0.0, Math.max(hopA, hopB), -0.6, {
      mode: "stand", phase: q(t * 1.3, 20), expr: t < 50.47 ? "grin" : "laugh", blink: lidAt(t, 1, [49.0, 50.47]),
      tilt: liveTilt(t, 1, 2.4), headTilt: liveHead(t, 1, 3.6), prop: "salute", look: 0, facing: 0,
    }, 0.88);
    addChar(WHO_ELON, 0.88, 0, -1.1, {
      mode: "stand", phase: q(t * 1.1, 20), expr: "smile", blink: lidAt(t, 2), tilt: liveTilt(t, 2, 2.0), headTilt: liveHead(t, 2, 3.0),
      prop: "cheer", look: -1, facing: -1,
    }, 0.84);
    badge("job", "SECURITY GUARD", "FINALLY EMPLOYED!", "#2ecc71", "#ffffff", 0.0, 2.45, -0.4, 50.47, 52.3, 0.8);
    const sp = q((t * 0.5) % 1, 20);
    out.fx.push({ key: `fx|stars|s10|${sp}`, cw: 420, ch: 220, draw: (p) => fxStars(p, sp), x: 0.0, y: 2.12, z: -0.35, w: 0.9, h: 0.47 });
  }

  // reference to avoid unused-variable lint on `f`
  void f;
  return out;
};
