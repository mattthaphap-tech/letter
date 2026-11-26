import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const remTmp = process.env.REMOTION_TMP || "D:/remotion-tmp";
fs.mkdirSync(remTmp, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP = remTmp;

const outDir = path.resolve("out/anakpungut/stills");
fs.mkdirSync(outDir, { recursive: true });

const browserExecutable = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chromiumOptions = { gl: "angle" };

// 5 Key Hero Stills
const stills = [
  { frame: 90, name: "hero_f090_kos_wide" },          // 3.0 s: wide boarding room, letters piling up
  { frame: 300, name: "hero_f300_noodles" },          // 10.0 s: Mark eats his last (small!) noodle bowl
  { frame: 660, name: "hero_f660_photo" },            // 22.0 s: the photo insert (Elon + baby Mark)
  { frame: 1190, name: "hero_f1190_flip" },           // 39.7 s: photo flipped: Orphanage / Adopted Child No. 47
  { frame: 1500, name: "hero_f1500_guard" },          // 50.0 s: security guard Mark, golden hour
];

console.log("Bundling AnakShort with Remotion...");
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  publicDir: path.resolve("public"),
});

console.log("Selecting composition AnakShort...");
const composition = await selectComposition({
  serveUrl,
  id: "AnakShort",
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

console.log("All Anak Pungut stills rendered successfully!");
