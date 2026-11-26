import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const remTmp = process.env.REMOTION_TMP || "D:/remotion-tmp";
fs.mkdirSync(remTmp, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP = remTmp;

const outDir = path.resolve("out/lustig/stills");
fs.mkdirSync(outDir, { recursive: true });

const browserExecutable = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chromiumOptions = { gl: "angle" };

// 5 Key Hero Stills
const stills = [
  { frame: 20, name: "hero_f020_tower_sold" },        // 0.7 s: low heroic wide, SOLD! over the tower
  { frame: 200, name: "hero_f200_arrival" },          // 6.7 s: Lustig arrives in Paris with a suitcase
  { frame: 420, name: "hero_f420_car_tour" },         // 14.0 s: government car tour
  { frame: 580, name: "hero_f580_line_up" },          // 19.3 s: Poisson picked from the line-up (MCU)
  { frame: 770, name: "hero_f770_contract" },         // 25.7 s: contract + OFFICIAL stamp
  { frame: 1040, name: "hero_f1040_station" },        // 34.7 s: train station, golden hour
  { frame: 1450, name: "hero_f1450_arrest" },         // 48.3 s: handcuffs
  { frame: 1530, name: "hero_f1530_cell" },           // 51.0 s: jail cell
];

console.log("Bundling LustigShort with Remotion...");
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  publicDir: path.resolve("public"),
});

console.log("Selecting composition LustigShort...");
const composition = await selectComposition({
  serveUrl,
  id: "LustigShort",
  browserExecutable,
  chromiumOptions,
});

for (const s of stills) {
  const outputLocation = path.join(outDir, `${s.name}.jpg`);
  console.log(`Rendering still frame ${s.frame} -> ${outputLocation}...`);
  await renderStill({
    composition,
    serveUrl,
    output: outputLocation,
    frame: s.frame,
    imageFormat: "jpeg",
    jpegQuality: 95,
    browserExecutable,
    chromiumOptions,
  });
}

console.log("All Lustig stills rendered successfully!");
