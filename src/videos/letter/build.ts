// Procedural 3D sets & props for "A Letter 40 Years Late" (old house interior, 1951 orchard, troop-train platform)
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

/** Overhead banner texture (auto-fitted so text never clips): used for the troop-train sign */
export const headerBannerTex = (line1: string, line2: string, bg: string, topCol: string) =>
  ctex("ltHdr_" + line1, 1024, 256, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = INKC; g.lineWidth = 16;
    g.strokeRect(12, 12, 1000, 232);
    g.fillStyle = topCol; g.textAlign = "center";
    fitText(g, line1, 512, 110, 940, 68);
    g.fillStyle = "#ffffff";
    fitText(g, line2, 512, 196, 940, 48);
  });

/** Old cream wallpaper with faint stripes and tiny flowers */
export const wallpaperTex = () => ctex("ltWallpaper", 256, 256, (g, r) => {
  g.fillStyle = "#e6d6b6"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "rgba(160,120,80,0.10)";
  for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 24, 256);
  for (let i = 0; i < 28; i++) {
    const x = r() * 256, y = r() * 256;
    g.fillStyle = "rgba(160,90,90,0.28)"; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(90,130,90,0.28)"; g.beginPath(); g.arc(x + 7, y + 2, 3, 0, Math.PI * 2); g.fill();
  }
});

const box = (w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) =>
  new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z);

// ===============================================================================================================
// SET 1: GRANDMOTHER'S OLD HOUSE (wallpapered room, bookshelf with the favourite book, sunny window, kitchen table + chair, moving boxes)
// ===============================================================================================================
export const buildHouseSet = () => {
  const g = new THREE.Group();
  const b = new Batch();

  const floorM = lam("ltFloor", () => ({ map: rep(planksHD(), 2, 2) }));
  const wallM = lam("ltWall", () => ({ map: rep(wallpaperTex(), 3, 2) }));
  const baseM = lam("ltBase", () => ({ color: "#6b4a3c" }));
  const woodM = lam("ltWood", () => ({ map: beamHD() }));
  const darkWoodM = lam("ltDarkWood", () => ({ color: "#4a3328" }));
  const rugM = lam("ltRug", () => ({ color: "#8a2f3a" }));
  const rugEdgeM = lam("ltRugEdge", () => ({ color: "#5a1f28" }));
  const glassM = lam("ltGlass", () => ({ color: "#cfe8ff" }));
  const curtainM = lam("ltCurtain", () => ({ color: "#c9a982" }));
  const frameM = lam("ltFrame", () => ({ color: "#8a6a3b" }));
  const picM = lam("ltPic", () => ({ color: "#d8cdb4" }));
  const cardM = lam("ltCardboard", () => ({ color: "#c28a50" }));
  const cardDarkM = lam("ltCardboardDark", () => ({ color: "#a06c38" }));
  const cupM = lam("ltCup", () => ({ color: "#f4f1ea" }));
  const favM = lam("ltFavBook", () => ({ color: "#a8272f" }));
  const envM = lam("ltEnvelope", () => ({ color: "#f2c94c" }));
  const bookColors = ["#2f5d8a", "#7a3b3b", "#3b6b4a", "#8a6a3b", "#5a4a7a", "#b08a4a"];
  const bookMs = bookColors.map((c, i) => lam("ltBook" + i, () => ({ color: c })));

  // Shell: floor, wallpapered back/side walls, baseboard, rug
  b.add(box(8, 0.3, 8, 0, -0.15, -0.5), floorM);
  b.add(box(6.8, 5.4, 0.25, 0, 2.7, -3.55), wallM);
  b.add(box(0.25, 5.4, 6.2, -2.75, 2.7, -0.6), wallM);
  b.add(box(0.25, 5.4, 6.2, 2.75, 2.7, -0.6), wallM);
  b.add(box(6.8, 0.18, 0.06, 0, 0.09, -3.4), baseM);
  b.add(box(2.7, 0.02, 1.9, 0.1, 0.01, -1.6), rugEdgeM);
  b.add(box(2.5, 0.025, 1.7, 0.1, 0.012, -1.6), rugM);

  // Sunny window with curtains (x = 1.15, y = 1.9)
  b.add(box(1.1, 1.4, 0.06, 1.15, 1.9, -3.40), glassM);
  b.add(box(1.34, 0.08, 0.14, 1.15, 2.64, -3.36), woodM);
  b.add(box(1.34, 0.08, 0.20, 1.15, 1.2, -3.33), woodM);
  b.add(box(0.08, 1.4, 0.14, 0.58, 1.9, -3.36), woodM);
  b.add(box(0.08, 1.4, 0.14, 1.72, 1.9, -3.36), woodM);
  b.add(box(0.06, 1.4, 0.10, 1.15, 1.9, -3.34), woodM);
  b.add(box(1.1, 0.06, 0.10, 1.15, 1.9, -3.34), woodM);
  b.add(box(0.26, 1.7, 0.10, 0.42, 1.85, -3.28), curtainM);
  b.add(box(0.26, 1.7, 0.10, 1.88, 1.85, -3.28), curtainM);

  // Bookshelf (x = -1.35) with rows of books; one thick red favourite book pulled out, a yellow envelope tucked inside
  const bz = -3.1;
  b.add(box(0.06, 2.3, 0.35, -2.1, 1.15, bz), darkWoodM);
  b.add(box(0.06, 2.3, 0.35, -0.6, 1.15, bz), darkWoodM);
  b.add(box(1.56, 0.06, 0.35, -1.35, 2.3, bz), darkWoodM);
  b.add(box(1.5, 2.3, 0.04, -1.35, 1.15, -3.27), baseM);
  const r = rng(7);
  for (const [row, y0] of [[0, 0.03], [1, 0.75], [2, 1.47]] as const) {
    b.add(box(1.5, 0.05, 0.35, -1.35, y0, bz), darkWoodM);
    let x = -2.02;
    while (x < -0.66) {
      const w = 0.05 + r() * 0.04, h = 0.34 + r() * 0.16;
      if (!(row === 2 && x > -1.12 && x < -0.92)) b.add(box(w, h, 0.24, x + w / 2, y0 + 0.025 + h / 2, bz), bookMs[Math.floor(r() * bookMs.length) % bookMs.length]);
      x += w + 0.008;
    }
  }
  b.add(box(0.11, 0.46, 0.27, -1.02, 1.47 + 0.025 + 0.23, bz + 0.1), favM);
  b.add(box(0.16, 0.012, 0.12, -1.02, 1.47 + 0.025 + 0.47, bz + 0.08, 0.2), envM);

  // Framed pictures on the wall
  b.add(box(0.42, 0.52, 0.04, -0.15, 2.1, -3.37), frameM);
  b.add(box(0.34, 0.44, 0.02, -0.15, 2.1, -3.35), picM);
  b.add(box(0.32, 0.4, 0.04, 0.32, 1.6, -3.37), frameM);
  b.add(box(0.24, 0.32, 0.02, 0.32, 1.6, -3.35), picM);

  // Kitchen table (x = 0.25, z = -1.35) with a tea cup, and Sarah's chair behind it
  b.add(box(1.2, 0.06, 0.8, 0.25, 0.75, -1.35), woodM);
  for (const [lx, lz] of [[-0.3, -1.7], [0.8, -1.7], [-0.3, -1.0], [0.8, -1.0]]) b.add(box(0.06, 0.72, 0.06, lx, 0.36, lz), darkWoodM);
  b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.012, 14).translate(0.62, 0.786, -1.3), cupM);
  b.add(new THREE.CylinderGeometry(0.04, 0.032, 0.07, 12).translate(0.62, 0.83, -1.3), cupM);
  b.add(box(0.45, 0.05, 0.45, -0.2, 0.45, -1.95), woodM);
  b.add(box(0.45, 0.5, 0.05, -0.2, 0.72, -2.18), woodM);
  for (const [lx, lz] of [[-0.4, -1.77], [0.0, -1.77], [-0.4, -2.15], [0.0, -2.15]]) b.add(box(0.04, 0.43, 0.04, lx, 0.215, lz), darkWoodM);

  // Moving boxes
  b.add(box(0.55, 0.4, 0.42, 1.55, 0.2, -2.45, 0.2), cardM);
  b.add(box(0.45, 0.35, 0.4, 1.5, 0.575, -2.45, -0.15), cardDarkM);
  b.add(box(0.5, 0.4, 0.4, 0.75, 0.2, -2.8, 0.1), cardM);

  b.build(g, true);

  // Soft HDR glow: sunlit window pane + a few floating dust motes in the light
  const sun = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.9, 2.2), fog: false });
  const pane = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 0.03), sun);
  pane.position.set(1.15, 1.9, -3.36); pane.layers.set(NOINK); g.add(pane);
  const dust = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.4), fog: false });
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), dust);
    m.position.set(0.5 + r() * 0.9, 0.8 + r() * 1.5, -2.9 + r() * 1.9); m.layers.set(NOINK); g.add(m);
  }
  return g;
};

// ===============================================================================================================
// SET 2: SUMMER 1951 ORCHARD (meadow with wildflowers, picket fence, apple trees, bench, flower arch)
// ===============================================================================================================
export const buildOrchardSet = () => {
  const g = new THREE.Group();
  const b = new Batch();

  const lawnM = lam("ltLawn", () => ({ map: rep(grassHD(), 6, 5) }));
  const pathM = lam("ltPath", () => ({ color: "#cdb48a" }));
  const whiteM = lam("ltWhite", () => ({ color: "#f4f1ea" }));
  const woodM = lam("ltOrchardWood", () => ({ color: "#8a6a3b" }));
  const hillM = lam("ltHill", () => ({ color: "#4f9a4a" }));
  const hill2M = lam("ltHill2", () => ({ color: "#3f8a45" }));
  const flowerMs = ["#ff7a9a", "#ffd43b", "#ffffff", "#9a7aff"].map((c, i) => lam("ltFlower" + i, () => ({ color: c })));

  b.add(box(40, 0.4, 34, 0, -0.2, -10), lawnM);
  b.add(box(1.4, 0.03, 14, 0.3, 0.02, -3), pathM);
  b.add(box(30, 2.0, 4, -6, 0.6, -15), hillM);
  b.add(box(30, 2.6, 4, 9, 0.9, -17), hill2M);

  // Picket fence (z = -3.6)
  for (let i = -16; i <= 16; i++) b.add(box(0.06, 0.9, 0.04, i * 0.35, 0.45, -3.6), whiteM);
  b.add(box(11.4, 0.06, 0.04, 0, 0.3, -3.62), whiteM);
  b.add(box(11.4, 0.06, 0.04, 0, 0.7, -3.62), whiteM);

  addTree(b, -3.2, 0, -5.0, 4.4, 5);
  addTree(b, 3.4, 0, -5.2, 4.6, 9);
  addTree(b, -5.6, 0, -7.4, 5.0, 13);
  addTree(b, 5.9, 0, -7.8, 4.8, 17);

  // Bench
  b.add(box(1.2, 0.06, 0.4, -1.9, 0.45, -1.8), woodM);
  b.add(box(1.2, 0.4, 0.05, -1.9, 0.7, -1.98), woodM);
  for (const lx of [-2.4, -1.4]) b.add(box(0.06, 0.45, 0.4, lx, 0.225, -1.8), woodM);

  // Flower arch behind the couple (x = 0, z = -2.2)
  b.add(box(0.1, 2.3, 0.1, -0.8, 1.15, -2.2), whiteM);
  b.add(box(0.1, 2.3, 0.1, 0.8, 1.15, -2.2), whiteM);
  b.add(box(1.7, 0.1, 0.1, 0, 2.35, -2.2), whiteM);
  for (let i = 0; i < 9; i++) b.add(box(0.15, 0.15, 0.15, -0.76 + i * 0.19, 2.42 + (i % 2) * 0.04, -2.2), flowerMs[i % 4]);

  // Wildflowers scattered in the meadow
  const r = rng(23);
  for (let i = 0; i < 90; i++) {
    const fx = -4.2 + r() * 8.4, fz = -3.2 + r() * 3.9;
    if (Math.abs(fx - 0.3) < 0.8 && fz > -3.0) continue;
    b.add(box(0.05, 0.13, 0.05, fx, 0.065, fz), flowerMs[i % 4]);
  }

  b.build(g, true);
  return g;
};

// ===============================================================================================================
// SET 3: TROOP-TRAIN PLATFORM: platform, canopy, green carriage with lit windows, steam, hanging sign
// ===============================================================================================================
export const buildStationSet = () => {
  const g = new THREE.Group();
  const b = new Batch();

  const platM = lam("lsPlatform", () => ({ map: rep(stoneHD("lsPlatformHD"), 6, 3) }));
  const gravelM = lam("lsGravel", () => ({ color: "#4a4036" }));
  const edgeM = lam("lsEdge", () => ({ color: "#ffd43b" }));
  const trainM = lam("lsTrain", () => ({ color: "#2f5a45" }));
  const stripeM = lam("lsTrainStripe", () => ({ color: "#8a1f2d" }));
  const trainWinM = lam("lsTrainWin", () => ({ color: "#ffe8a8" }));
  const doorM = lam("lsTrainDoor", () => ({ color: "#1a1a1f" }));
  const wheelM = lam("lsTrainWheel", () => ({ color: "#222228" }));
  const canopyM = lam("lsCanopy", () => ({ color: "#3a4a5a" }));
  const postM = lam("lsPost", () => ({ color: "#1f3a3a" }));
  const steamM = lam("lsSteam", () => ({ color: "#f4f4f4" }));
  const crateM = lam("lsCrate", () => ({ color: "#a06c38" }));
  const signM = lam("ltStationSign", () => ({ map: headerBannerTex("TO THE FRONT", "TROOP TRAIN 1951", "#2b3a24", "#ffd43b") }));

  // Platform, yellow safety edge, track bed
  b.add(box(18, 0.5, 6, 0, -0.25, -1.6), platM);
  b.add(box(18, 0.02, 0.15, 0, 0.01, 1.3), edgeM);
  b.add(box(18, 0.3, 3.0, 0, -0.65, -5.8), gravelM);

  // Train carriage behind the platform
  b.add(box(10, 2.5, 2.2, 0, 1.2, -5.2), trainM);
  b.add(box(10, 0.35, 2.22, 0, 0.45, -5.2), stripeM);
  for (const wx of [-3.6, -2.4, -1.2, 1.4, 2.6, 3.8]) b.add(box(0.8, 0.8, 0.06, wx, 1.7, -4.08), trainWinM);
  b.add(box(0.9, 1.9, 0.06, 0.1, 1.05, -4.07), doorM);
  for (const wx of [-3.5, -1.8, 1.8, 3.5]) b.add(new THREE.CylinderGeometry(0.45, 0.45, 0.14, 14).rotateX(Math.PI / 2).translate(wx, -0.1, -4.1), wheelM);
  b.add(new THREE.CylinderGeometry(0.3, 0.38, 1.2, 10).translate(3.9, 3.35, -5.2), doorM);       // chimney
  for (const [sx, sy, sr] of [[3.9, 4.3, 0.36], [4.35, 4.85, 0.46], [4.95, 5.5, 0.56]] as const) b.add(new THREE.SphereGeometry(sr, 10, 10).translate(sx, sy, -5.2), steamM);

  // Canopy (posts + roof) and hanging sign
  for (const px of [-6.5, -3.0, 3.0, 6.5]) b.add(new THREE.CylinderGeometry(0.1, 0.13, 3.7, 8).translate(px, 1.85, 0.6), postM);
  b.add(box(18, 0.16, 3.6, 0, 3.75, -0.9), canopyM);
  b.add(box(2.4, 0.6, 0.06, 0, 3.0, 0.5), signM);
  b.add(box(0.04, 0.5, 0.04, -1.0, 3.45, 0.5), postM);
  b.add(box(0.04, 0.5, 0.04, 1.0, 3.45, 0.5), postM);

  // Luggage
  b.add(box(0.5, 0.35, 0.35, -1.9, 0.175, -1.3, 0.3), crateM);
  b.add(box(0.4, 0.3, 0.3, -1.5, 0.15, -1.1, -0.2), crateM);

  b.build(g, true);

  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.3, 1.0), fog: false });
  for (const px of [-3.0, 3.0]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), glow);
    m.position.set(px, 3.5, 0.6); m.layers.set(NOINK); g.add(m);
  }
  return g;
};

