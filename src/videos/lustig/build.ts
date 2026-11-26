// Procedural 3D sets & props for "The Man Who Sold the Eiffel Tower" (Paris plaza with a rusting Eiffel Tower, train station, jail cell)
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

/** Overhead banner texture (auto-fitted so text never clips): used for the station sign */
export const headerBannerTex = (line1: string, line2: string, bg: string, topCol: string) =>
  ctex("lsHdr_" + line1, 1024, 256, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = INKC; g.lineWidth = 16;
    g.strokeRect(12, 12, 1000, 232);
    g.fillStyle = topCol; g.textAlign = "center";
    fitText(g, line1, 512, 110, 940, 68);
    g.fillStyle = "#ffffff";
    fitText(g, line2, 512, 196, 940, 48);
  });

/** Rusty wrought-iron lattice (diagonal cross-bracing) for the Eiffel Tower */
export const latticeTex = () => ctex("lsLattice", 256, 256, (g) => {
  g.fillStyle = "#7a4f3b"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#3b241c"; g.lineWidth = 10;
  for (let i = -4; i < 5; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 256, 256); g.stroke();
    g.beginPath(); g.moveTo(i * 64 + 256, 0); g.lineTo(i * 64, 256); g.stroke();
  }
  g.strokeStyle = "#a8643a"; g.lineWidth = 5;
  g.strokeRect(2, 2, 252, 252);
});

/** Brick wall for the jail cell */
export const brickTex = () => ctex("lsBrick", 256, 256, (g, r) => {
  g.fillStyle = "#c9b59a"; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 32 : 0;
    for (let col = -1; col < 5; col++) {
      const sh = 0.85 + r() * 0.3;
      const c = Math.round(138 * sh), d = Math.round(90 * sh), e = Math.round(74 * sh);
      g.fillStyle = `rgb(${c},${d},${e})`;
      g.fillRect(col * 64 + off + 3, row * 32 + 3, 58, 26);
    }
  }
});

const box = (w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) =>
  new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z);

// ===============================================================================================================
// SET 1: PARIS PLAZA (1925): stone plaza, Haussmann blocks, street lamps, government car, a rusting Eiffel Tower in the back
// ===============================================================================================================
export const buildParisSet = () => {
  const g = new THREE.Group();
  const b = new Batch();

  const plazaM = lam("lsPlaza", () => ({ map: rep(stoneHD("lsPlazaHD"), 9, 7) }));
  const ironM = lam("lsIron", () => ({ map: rep(latticeTex(), 1, 3) }));
  const ironFlatM = lam("lsIronFlat", () => ({ color: "#6b4a3a" }));
  const wallM = lam("lsHaussWall", () => ({ color: "#e8dcc4" }));
  const roofM = lam("lsHaussRoof", () => ({ color: "#5a6678" }));
  const winM = lam("lsHaussWin", () => ({ color: "#3b4a63" }));
  const lampM = lam("lsLampPost", () => ({ color: "#1f3a3a" }));
  const carM = lam("lsCarBody", () => ({ color: "#2f4a3a" }));
  const carGlassM = lam("lsCarGlass", () => ({ color: "#a9d4ea" }));
  const blackM = lam("lsCarBlack", () => ({ color: "#1a1a1f" }));
  const hubM = lam("lsCarHub", () => ({ color: "#d8d8d8" }));
  const flagBlue = lam("lsFlagBlue", () => ({ color: "#2b4fb0" }));
  const flagWhite = lam("lsFlagWhite", () => ({ color: "#f4f1ea" }));
  const flagRed = lam("lsFlagRed", () => ({ color: "#d43b3b" }));

  // Ground
  b.add(box(60, 0.4, 44, 0, -0.2, -14), plazaM);

  // Eiffel Tower (z = -15): four leaning legs, first platform, tapering shaft, second platform, upper shaft, spire
  const tz = -15;
  const baseR = 2.25, topR = 0.975, legH = 3.45;
  const lean = Math.atan((baseR - topR) / legH);
  const legLen = Math.sqrt(legH * legH + 2 * (baseR - topR) * (baseR - topR));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(
      new THREE.CylinderGeometry(0.2, 0.3, legLen, 6).rotateX(-sz * lean).rotateZ(sx * lean)
        .translate(sx * (baseR + topR) / 2, legH / 2, tz + sz * (baseR + topR) / 2),
      ironM,
    );
  }
  b.add(box(2.9, 0.22, 2.9, 0, legH + 0.11, tz), ironFlatM);                                          // platform 1
  b.add(new THREE.CylinderGeometry(0.56, 0.94, 5.25, 4).rotateY(Math.PI / 4).translate(0, legH + 2.625, tz), ironM); // shaft
  b.add(box(1.7, 0.18, 1.7, 0, legH + 5.34, tz), ironFlatM);                                           // platform 2
  b.add(new THREE.CylinderGeometry(0.26, 0.5, 2.4, 4).rotateY(Math.PI / 4).translate(0, legH + 6.6, tz), ironM);    // upper shaft
  b.add(new THREE.ConeGeometry(0.14, 2.3, 4).translate(0, legH + 8.9, tz), ironFlatM);                 // spire

  // Haussmann blocks on both sides (windows face the plaza)
  for (const side of [-1, 1]) {
    for (const [bz, bh] of [[-9.5, 9.0], [-15.0, 10.0]] as const) {
      const bx = side * 7.2;
      b.add(box(5.0, bh, 4.0, bx, bh / 2, bz), wallM);
      b.add(box(5.4, 2.0, 4.4, bx, bh + 1.0, bz), roofM);
      const fx = bx - side * 2.53;
      for (const wy of [2.0, 4.4, 6.8]) for (const wz of [-1.2, 0, 1.2]) {
        b.add(box(0.06, 1.1, 0.7, fx, wy, bz + wz), winM);
      }
    }
  }

  // Street lamps (glowing globes are added later on the bloom layer)
  for (const lx of [-1.7, 1.7]) {
    b.add(new THREE.CylinderGeometry(0.04, 0.06, 3.0, 8).translate(lx, 1.5, -2.8), lampM);
    b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8).translate(lx, 0.04, -2.8), lampM);
  }

  // Government car (side view, behind the actors): x = 0.9, z = -2.0
  const cx = 0.9, cz = -2.0;
  b.add(box(2.1, 0.5, 0.95, cx, 0.55, cz), carM);
  b.add(box(1.0, 0.55, 0.9, cx - 0.25, 1.07, cz), carM);
  b.add(box(0.92, 0.38, 0.92, cx - 0.25, 1.1, cz), carGlassM);
  b.add(box(2.3, 0.1, 1.1, cx, 0.32, cz), blackM);
  for (const wx of [-0.7, 0.7]) for (const wz of [-0.52, 0.52]) {
    b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14).rotateX(Math.PI / 2).translate(cx + wx, 0.3, cz + wz), blackM);
    b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 10).rotateX(Math.PI / 2).translate(cx + wx, 0.3, cz + wz), hubM);
  }
  // tiny tricolour flag on the hood (very official, very fake)
  b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6).translate(cx + 0.85, 1.1, cz), blackM);
  b.add(box(0.08, 0.16, 0.02, cx + 0.9, 1.32, cz), flagBlue);
  b.add(box(0.08, 0.16, 0.02, cx + 0.98, 1.32, cz), flagWhite);
  b.add(box(0.08, 0.16, 0.02, cx + 1.06, 1.32, cz), flagRed);

  addTree(b, -4.4, 0, -6.0, 4.2, 11);
  addTree(b, 4.6, 0, -6.2, 4.4, 23);

  b.build(g, true);

  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.3, 1.0), fog: false });
  for (const lx of [-1.7, 1.7]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), glow);
    m.position.set(lx, 3.1, -2.8); m.layers.set(NOINK); g.add(m);
  }
  return g;
};

// ===============================================================================================================
// SET 2: TRAIN STATION (Vienna Express): platform, canopy, green carriage with lit windows, steam, hanging sign
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
  const signM = lam("lsStationSign", () => ({ map: headerBannerTex("VIENNA EXPRESS", "DEPARTURE 10:15", "#14264f", "#ffd43b") }));

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

// ===============================================================================================================
// SET 3: JAIL CELL (brick walls, bunk, barred window with a cold light, iron bars in front of the camera)
// ===============================================================================================================
export const buildCellSet = () => {
  const g = new THREE.Group();
  const b = new Batch();

  const floorM = lam("lsCellFloor", () => ({ map: rep(stoneHD("lsCellFloorHD"), 4, 3) }));
  const brickM = lam("lsCellBrick", () => ({ map: rep(brickTex(), 3, 2) }));
  const ceilM = lam("lsCellCeil", () => ({ color: "#5a4a44" }));
  const barM = lam("lsCellBar", () => ({ color: "#26262c" }));
  const bunkM = lam("lsBunk", () => ({ color: "#6b4a3a" }));
  const blanketM = lam("lsBlanket", () => ({ color: "#7a8088" }));
  const skyM = lam("lsCellSky", () => ({ color: "#bfe6ff" }));

  b.add(box(6, 0.2, 5, 0, -0.1, -0.6), floorM);
  b.add(box(6, 4.2, 0.3, 0, 2.1, -3.0), brickM);
  b.add(box(0.3, 4.2, 5, -2.8, 2.1, -0.6), brickM);
  b.add(box(0.3, 4.2, 5, 2.8, 2.1, -0.6), brickM);
  b.add(box(6, 0.2, 5, 0, 4.2, -0.6), ceilM);

  // Barred window high on the back wall
  b.add(box(0.8, 1.0, 0.05, 0.9, 2.7, -2.82), skyM);
  for (const wx of [0.65, 0.9, 1.15]) b.add(box(0.04, 1.0, 0.07, wx, 2.7, -2.78), barM);

  // Bunk
  b.add(box(1.5, 0.4, 0.75, -1.7, 0.3, -2.4), bunkM);
  b.add(box(1.4, 0.12, 0.65, -1.7, 0.56, -2.4), blanketM);

  // Cell bars in front of the actors (z = 0.1): spaced 0.4 m so they flank a face at x = 0
  for (let i = 0; i < 8; i++) b.add(box(0.06, 3.8, 0.06, -1.4 + i * 0.4, 1.9, 0.1), barM);
  b.add(box(3.4, 0.08, 0.08, 0, 0.7, 0.1), barM);
  b.add(box(3.4, 0.08, 0.08, 0, 3.0, 0.1), barM);

  b.build(g, true);

  const light = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 2.2, 3.0), fog: false });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.04), light);
  m.position.set(0.9, 2.7, -2.8); m.layers.set(NOINK); g.add(m);
  return g;
};
