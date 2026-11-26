// Procedural 3D sets & props for "Anak Pungut Sultan" (night boarding room + day mansion gate)
// Built on the proven two-tone Lambert + InkPass + hand-painted Canvas2D texture pipeline.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng, ctex, rep, grassHD, stoneHD, planksHD, beamHD } from "./paint";
import { twoTone } from "./shade";
import { NOINK } from "./ink";

export type Kit = Record<string, THREE.Object3D>;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- materials (shared, cached, all two-tone shaded) ----------------
const mats = new Map<string, THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    m = twoTone(new THREE.MeshLambertMaterial(make()));
    mats.set(key, m);
  }
  return m;
};

const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};

export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else x.computeVertexNormals();
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (m) x.applyMatrix4(m);
    const l = this.g.get(mat);
    if (l) l.push(x); else this.g.set(mat, [x]);
  }
  build(parent: THREE.Object3D, cast = true) {
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.g.clear();
  }
}

// ---------------- cartoon trees ----------------
const LEAF = ["#5aa83c", "#4c9a37", "#69b545", "#55a243", "#3f8f3c"];
const leafTex = (i: number) => ctex("leafS" + i, 256, 128, (g) => {
  const base = new THREE.Color(LEAF[i % LEAF.length]), top = base.clone().offsetHSL(0.01, 0.03, 0.08), bot = base.clone().offsetHSL(-0.01, 0, -0.08);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "#" + top.getHexString()); gr.addColorStop(0.5, "#" + base.getHexString()); gr.addColorStop(1, "#" + bot.getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
});
const leafMat = (i: number) => lam("leafS" + i, () => ({ map: leafTex(i) }));
const barkMat = () => lam("barkS", () => ({ color: "#8f5d3b" }));
const SPH = new THREE.SphereGeometry(1, 14, 10);
const TRUNK = new THREE.CylinderGeometry(0.55, 1, 1, 8, 1).translate(0, 0.5, 0);

export const addTree = (b: Batch, x: number, y: number, z: number, h: number, seed: number) => {
  const r = rng(Math.abs(Math.floor(seed * 97 + 13)));
  const leaf = leafMat(Math.floor(r() * 4));
  const tr = 0.07 * h, th = 0.42 * h;
  b.add(TRUNK, barkMat(), new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion(), V(tr, th, tr)));
  const cy = y + 0.62 * h;
  const put = (dx: number, dy: number, dz: number, rad: number) =>
    b.add(SPH, leaf, new THREE.Matrix4().compose(V(x + dx, cy + dy, z + dz), new THREE.Quaternion(), V(rad, rad * 0.88, rad)));
  put(0, 0, 0, 0.28 * h);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + r() * 0.5, d = 0.18 * h;
    put(Math.cos(a) * d, -0.05 * h, Math.sin(a) * d, 0.21 * h);
  }
  put(0, 0.16 * h, 0, 0.19 * h);
};

/** Helper to draw auto-fitted text inside Canvas2D textures so it never clips */
const fitText = (
  g: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxW: number,
  startPx: number,
  weight = "900",
  family = "sans-serif"
) => {
  let sz = startPx;
  g.font = `${weight} ${sz}px ${family}`;
  while (g.measureText(text).width > maxW && sz > 16) {
    sz -= 2;
    g.font = `${weight} ${sz}px ${family}`;
  }
  g.fillText(text, cx, cy);
};

// ---------------- Hand-Painted Custom Canvas2D Textures ----------------
const INKC = "#241726";

/** Round wall clock face showing 17:59 */
export const kosClockTex = () => ctex("apClockTex", 512, 512, (g) => {
  g.fillStyle = "#f4efe2"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = INKC; g.lineWidth = 22; g.strokeRect(11, 11, 490, 490);
  g.fillStyle = "#fffaf0"; g.beginPath(); g.arc(256, 256, 214, 0, Math.PI * 2); g.fill();
  g.lineWidth = 14; g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.lineWidth = i % 3 === 0 ? 14 : 7;
    g.beginPath(); g.moveTo(256 + Math.sin(a) * 178, 256 - Math.cos(a) * 178); g.lineTo(256 + Math.sin(a) * 204, 256 - Math.cos(a) * 204); g.stroke();
  }
  const hand = (frac: number, len: number, w: number) => {
    const a = frac * Math.PI * 2;
    g.lineWidth = w; g.lineCap = "round";
    g.beginPath(); g.moveTo(256, 256); g.lineTo(256 + Math.sin(a) * len, 256 - Math.cos(a) * len); g.stroke();
  };
  hand((5 + 59 / 60) / 12, 120, 20); // hour hand, almost 6
  hand(59 / 60, 176, 12);            // minute hand, almost 12
  g.fillStyle = INKC; g.beginPath(); g.arc(256, 256, 16, 0, Math.PI * 2); g.fill();
});

/** Night skyline seen through the neon window */
export const kosWindowTex = () => ctex("apWindowTex", 512, 640, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 640);
  gr.addColorStop(0, "#0f1a44"); gr.addColorStop(0.6, "#2c4286"); gr.addColorStop(1, "#6a3b9c");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 640);
  g.fillStyle = "#f6f0c8"; g.beginPath(); g.arc(400, 110, 44, 0, Math.PI * 2); g.fill();
  let x = 0;
  while (x < 512) {
    const w = 60 + r() * 70, h = 220 + r() * 260;
    g.fillStyle = r() > 0.5 ? "#16225a" : "#1b2a6b";
    g.fillRect(x, 640 - h, w, h);
    for (let wy = 640 - h + 18; wy < 620; wy += 30) for (let wx = x + 10; wx < x + w - 14; wx += 22) {
      if (r() > 0.55) { g.fillStyle = r() > 0.5 ? "#ffd77a" : "#ff7ad9"; g.fillRect(wx, wy, 10, 14); }
    }
    x += w + 6;
  }
});

/** Top sheet of the rejection-letter pile, with a red REJECTED stamp */
export const kosLetterTex = () => ctex("apLetterTex", 256, 192, (g) => {
  g.fillStyle = "#fbfaf5"; g.fillRect(0, 0, 256, 192);
  g.strokeStyle = "#b9b6aa"; g.lineWidth = 3;
  for (let y = 30; y < 90; y += 14) { g.beginPath(); g.moveTo(24, y); g.lineTo(230, y); g.stroke(); }
  g.save(); g.translate(128, 128); g.rotate(-0.22);
  g.strokeStyle = "#e23b3b"; g.lineWidth = 8; g.strokeRect(-100, -30, 200, 60);
  g.fillStyle = "#e23b3b"; g.textAlign = "center";
  fitText(g, "REJECTED", 0, 14, 180, 44);
  g.restore();
});

/** Small instant-noodle packet (about 13 x 9 cm) */
export const kosNoodleTex = () => ctex("apNoodleTex", 256, 176, (g) => {
  g.fillStyle = "#f0742a"; g.fillRect(0, 0, 256, 176);
  g.strokeStyle = INKC; g.lineWidth = 10; g.strokeRect(5, 5, 246, 166);
  g.fillStyle = "#fff1c9"; g.beginPath(); g.ellipse(128, 72, 70, 40, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = "#ffffff"; g.textAlign = "center";
  fitText(g, "NOODLES", 128, 150, 210, 44);
});

/** Overhead banner texture (auto-fitted so text never clips): used for the ELON ESTATE gate sign */
export const headerBannerTex = (line1: string, line2: string, bg: string, topCol: string) =>
  ctex("apHdr_" + line1, 1024, 256, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = "#241726"; g.lineWidth = 16;
    g.strokeRect(12, 12, 1000, 232);
    g.fillStyle = topCol; g.textAlign = "center";
    fitText(g, line1, 512, 110, 940, 68);
    g.fillStyle = "#ffffff";
    fitText(g, line2, 512, 196, 940, 48);
  });

const box = (w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) =>
  new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z);

// ===============================================================================================================
// SET 1: KOS ROOM AT NIGHT (bed, desk with lamp / noodles / rejection letters, neon window, wall clock, old box)
// ===============================================================================================================
export const buildKosSet = () => {
  const g = new THREE.Group();
  const b = new Batch();

  const floorM = lam("apKosFloor", () => ({ map: rep(planksHD(), 2, 2) }));
  const wallM = lam("apKosWall", () => ({ color: "#8a6a9e" }));
  const wainM = lam("apKosWain", () => ({ color: "#6b4a3c" }));
  const woodM = lam("apKosWood", () => ({ map: beamHD() }));
  const deskM = lam("apKosDesk", () => ({ map: planksHD() }));
  const blanketM = lam("apKosBlanket", () => ({ color: "#b3263a" }));
  const sheetM = lam("apKosSheet", () => ({ color: "#ddd6ea" }));
  const pillowM = lam("apKosPillow", () => ({ color: "#f3efe6" }));
  const windowM = lam("apKosWindow", () => ({ map: kosWindowTex() }));
  const clockM = lam("apKosClock", () => ({ map: kosClockTex() }));
  const letterM = lam("apKosLetter", () => ({ color: "#fbfaf5" }));
  const letterTopM = lam("apKosLetterTop", () => ({ map: kosLetterTex() }));
  const packM = lam("apKosPack", () => ({ map: kosNoodleTex() }));
  const bowlM = lam("apKosBowl", () => ({ color: "#f4f1ea" }));
  const noodleM = lam("apKosNoodle", () => ({ color: "#e0a84c" }));
  const goldM = lam("apKosGold", () => ({ color: "#f2b94b" }));
  const cardboardM = lam("apKosCardboard", () => ({ color: "#c28a50" }));
  const cardboardDarkM = lam("apKosCardboardDark", () => ({ color: "#a06c38" }));
  const toyM = lam("apKosToy", () => ({ color: "#3a8fdb" }));
  const toy2M = lam("apKosToy2", () => ({ color: "#ffd84a" }));

  // Room shell: planks floor, back wall + wainscot, side walls
  b.add(box(8, 0.3, 8, 0, -0.15, -0.5), floorM);
  b.add(box(6.8, 5.4, 0.25, 0, 2.7, -3.55), wallM);
  b.add(box(6.8, 1.0, 0.12, 0, 0.5, -3.37), wainM);
  b.add(box(0.25, 5.4, 6.2, -2.75, 2.7, -0.6), wallM);
  b.add(box(0.25, 5.4, 6.2, 2.75, 2.7, -0.6), wallM);

  // Neon window on the back wall (x = 0.45, y = 2.3)
  b.add(box(1.1, 1.35, 0.06, 0.45, 2.3, -3.40), windowM);
  b.add(box(1.34, 0.10, 0.14, 0.45, 3.0, -3.36), woodM);
  b.add(box(1.34, 0.10, 0.20, 0.45, 1.6, -3.33), woodM);
  b.add(box(0.10, 1.35, 0.14, -0.16, 2.3, -3.36), woodM);
  b.add(box(0.10, 1.35, 0.14, 1.06, 2.3, -3.36), woodM);
  b.add(box(0.06, 1.35, 0.10, 0.45, 2.3, -3.34), woodM);
  b.add(box(1.1, 0.06, 0.10, 0.45, 2.3, -3.34), woodM);

  // Wall clock (17:59)
  b.add(box(0.62, 0.62, 0.06, -0.85, 2.6, -3.38), clockM);

  // Bed (long side to the room): frame, mattress, red blanket, pillow, headboard + occluding footboard
  b.add(box(1.4, 0.24, 1.15, -0.78, 0.12, -2.1), woodM);
  b.add(box(1.3, 0.22, 1.05, -0.78, 0.35, -2.1), sheetM);
  b.add(box(1.3, 0.14, 0.9, -0.78, 0.53, -2.05), blanketM);
  b.add(box(0.42, 0.12, 0.30, -1.22, 0.66, -2.45), pillowM);
  b.add(box(1.4, 0.95, 0.10, -0.78, 0.55, -2.72), woodM);
  b.add(box(1.4, 0.72, 0.10, -0.78, 0.36, -1.50), woodM);

  // Desk with lamp, noodle bowl + packet and a pile of rejection letters (x = 0.95, y = 0.78)
  b.add(box(1.0, 0.06, 0.58, 0.95, 0.78, -2.3), deskM);
  for (const [lx, lz] of [[0.5, -2.55], [1.4, -2.55], [0.5, -2.05], [1.4, -2.05]]) b.add(box(0.06, 0.75, 0.06, lx, 0.375, lz), woodM);
  b.add(new THREE.CylinderGeometry(0.085, 0.055, 0.07, 14).translate(0.82, 0.85, -2.2), bowlM);
  b.add(new THREE.CylinderGeometry(0.078, 0.078, 0.012, 14).translate(0.82, 0.888, -2.2), noodleM);
  b.add(box(0.13, 0.02, 0.09, 0.60, 0.82, -2.26, 0.3), packM);
  for (let i = 0; i < 8; i++) {
    b.add(box(0.20, 0.008, 0.15, 1.10 + (i % 2) * 0.006, 0.812 + i * 0.0085, -2.20, ((i * 37) % 11 - 5) * 0.012), letterM);
  }
  b.add(box(0.20, 0.004, 0.15, 1.10, 0.884, -2.20), letterTopM);
  b.add(new THREE.CylinderGeometry(0.085, 0.10, 0.03, 12).translate(1.3, 0.825, -2.45), goldM);
  b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8).translate(1.3, 1.04, -2.45), goldM);
  b.add(new THREE.ConeGeometry(0.14, 0.16, 12).translate(1.27, 1.30, -2.42), goldM);

  // Old cardboard box (x = 0.35, open, with junk inside)
  const bx = 0.35, bz = -1.15;
  b.add(box(0.56, 0.02, 0.46, bx, 0.01, bz), cardboardDarkM);
  b.add(box(0.56, 0.36, 0.02, bx, 0.19, bz + 0.22), cardboardM);
  b.add(box(0.56, 0.36, 0.02, bx, 0.19, bz - 0.22), cardboardM);
  b.add(box(0.02, 0.36, 0.46, bx - 0.27, 0.19, bz), cardboardM);
  b.add(box(0.02, 0.36, 0.46, bx + 0.27, 0.19, bz), cardboardM);
  b.add(new THREE.BoxGeometry(0.56, 0.015, 0.2).translate(0, 0, 0.1).rotateX(-0.9).translate(bx, 0.37, bz + 0.22), cardboardM);
  b.add(new THREE.BoxGeometry(0.56, 0.015, 0.2).translate(0, 0, -0.1).rotateX(0.9).translate(bx, 0.37, bz - 0.22), cardboardM);
  b.add(box(0.10, 0.10, 0.10, bx - 0.12, 0.2, bz + 0.05, 0.4), toyM);
  b.add(box(0.14, 0.04, 0.10, bx + 0.10, 0.16, bz - 0.06, -0.3), toy2M);
  b.add(box(0.18, 0.012, 0.13, bx + 0.02, 0.28, bz + 0.1, 0.25), letterM);

  b.build(g, true);

  // Motivated HDR glow: pink neon tube around the window + bulb inside the desk lamp (NOINK bloom layer)
  const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 0.55, 2.4), fog: false });
  for (const [w, h, x, y] of [[1.3, 0.05, 0.45, 3.06], [0.05, 1.5, -0.24, 2.3], [0.05, 1.5, 1.14, 2.3]] as const) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), neon);
    m.position.set(x, y, -3.3); m.layers.set(NOINK); g.add(m);
  }
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 1.1), fog: false }));
  bulb.position.set(1.27, 1.22, -2.42); bulb.layers.set(NOINK); g.add(bulb);

  return g;
};

// ===============================================================================================================
// SET 2: ELON ESTATE (iron gate, stone pillars, lawn + driveway, columned mansion) -- lit as day or golden hour
// ===============================================================================================================
export const buildMansionSet = () => {
  const g = new THREE.Group();
  const b = new Batch();

  const lawnM = lam("apLawn", () => ({ map: rep(grassHD(), 6, 5) }));
  const pathM = lam("apPath", () => ({ map: rep(stoneHD("apPathHD"), 2, 6) }));
  const plazaM = lam("apPlaza", () => ({ map: rep(stoneHD("apPlazaHD"), 5, 3) }));
  const wallM = lam("apMansionWall", () => ({ color: "#f3ead7" }));
  const roofM = lam("apMansionRoof", () => ({ color: "#7a4b3a" }));
  const colM = lam("apMansionColumn", () => ({ color: "#fffaf0" }));
  const doorM = lam("apMansionDoor", () => ({ color: "#d9a82b" }));
  const glassM = lam("apMansionGlass", () => ({ color: "#8fd0f5" }));
  const ironM = lam("apIron", () => ({ color: "#1f3a3a" }));
  const tipM = lam("apIronTip", () => ({ color: "#d9a82b" }));
  const pillarM = lam("apPillar", () => ({ map: stoneHD("apPillarHD") }));
  const hedgeM = lam("apHedge", () => ({ color: "#3f8d3f" }));
  const signM = lam("apEstateSign", () => ({ map: headerBannerTex("ELON ESTATE", "PRIVATE RESIDENCE", "#14264f", "#ffd43b") }));

  // Ground: lawn, stone driveway and plaza in front of the gate
  b.add(box(34, 0.4, 24, 0, -0.2, -8), lawnM);
  b.add(box(3.4, 0.05, 15, 0, 0.02, -0.6), pathM);
  b.add(box(10, 0.06, 5, 0, 0.03, 2.2), plazaM);

  // Mansion (back, z = -8.2): body, roof, pediment, columns, steps, door, windows
  b.add(box(7.0, 3.4, 1.6, 0, 1.7, -8.2), wallM);
  b.add(box(7.6, 0.25, 2.2, 0, 3.55, -8.2), roofM);
  b.add(new THREE.ConeGeometry(2.7, 1.2, 4).rotateY(Math.PI / 4).scale(1, 1, 0.5).translate(0, 4.2, -7.7), roofM);
  for (let i = 0; i < 6; i++) b.add(new THREE.CylinderGeometry(0.16, 0.18, 3.2, 12).translate(-2.5 + i, 1.6, -7.2), colM);
  b.add(box(3.4, 0.3, 0.8, 0, 0.15, -6.9), pillarM);
  b.add(box(1.0, 2.0, 0.08, 0, 1.0, -7.37), doorM);
  for (const wx of [-2.4, -1.4, 1.4, 2.4]) b.add(box(0.6, 1.0, 0.06, wx, 2.2, -7.38), glassM);

  // Iron fence (z = -2.6) with a 2 m open gate between the stone pillars
  const fz = -2.6;
  for (let i = -30; i <= 30; i++) {
    const x = i * 0.16;
    if (Math.abs(x) < 1.0) continue;
    b.add(box(0.04, 1.3, 0.04, x, 0.75, fz), ironM);
    b.add(new THREE.ConeGeometry(0.035, 0.1, 4).translate(x, 1.45, fz), tipM);
  }
  for (const [x0, x1] of [[-4.8, -1.0], [1.0, 4.8]] as const) {
    b.add(box(x1 - x0, 0.05, 0.05, (x0 + x1) / 2, 0.35, fz), ironM);
    b.add(box(x1 - x0, 0.05, 0.05, (x0 + x1) / 2, 1.2, fz), ironM);
  }
  for (const px of [-1.0, 1.0]) {
    b.add(box(0.34, 2.0, 0.34, px, 1.0, fz), pillarM);
    b.add(box(0.46, 0.1, 0.46, px, 2.05, fz), pillarM);
  }
  // Estate sign hanging across the gate
  b.add(box(1.5, 0.4, 0.06, 0, 2.15, fz), signM);
  b.add(box(0.05, 0.3, 0.05, -0.6, 1.95, fz), ironM);
  b.add(box(0.05, 0.3, 0.05, 0.6, 1.95, fz), ironM);

  // Hedges + framing trees
  b.add(box(3.2, 0.7, 0.6, -3.2, 0.35, -2.2), hedgeM);
  b.add(box(3.2, 0.7, 0.6, 3.2, 0.35, -2.2), hedgeM);
  addTree(b, -3.6, 0, -5.2, 3.8, 11);
  addTree(b, 3.6, 0, -5.2, 3.9, 23);
  addTree(b, -4.4, 0, -9.5, 4.3, 37);
  addTree(b, 4.4, 0, -9.5, 4.1, 49);

  b.build(g, true);

  // Motivated glowing gate lamps on the pillar caps (NOINK bloom layer)
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.3, 1.0), fog: false });
  for (const px of [-1.0, 1.0]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), lampMat);
    l.position.set(px, 2.24, fz); l.layers.set(NOINK); g.add(l);
  }
  return g;
};
