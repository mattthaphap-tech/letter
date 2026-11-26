import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const remTmp = process.env.REMOTION_TMP || "D:/remotion-tmp";
fs.mkdirSync(remTmp, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP = remTmp;

const outDir = path.resolve("out/letter/stills");
fs.mkdirSync(outDir, { recursive: true });

const browserExecutable = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chromiumOptions = { gl: "angle" };

// 5 Key Hero Stills
const stills = [
  { frame: 30, name: "hero_f030_envelope" },          // 1.0 s: macro yellow envelope
  { frame: 200, name: "hero_f200_framed_photo" },     // 6.7 s: Grandma Mary photo + Sarah
  { frame: 400, name: "hero_f400_bookshelf" },        // 13.3 s: Sarah with the envelope by the bookshelf
  { frame: 710, name: "hero_f710_letter" },           // 23.7 s: the letter macro
  { frame: 880, name: "hero_f880_orchard" },          // 29.3 s: 1951 orchard, Mary and Thomas
  { frame: 1020, name: "hero_f1020_station" },        // 34.0 s: troop-train platform at dusk
  { frame: 1250, name: "hero_f1250_family" },         // 41.7 s: Daniel, Mary and their daughter
  { frame: 1700, name: "hero_f1700_kitchen" },        // 56.7 s: the kitchen table, golden hour
];

console.log("Bundling LetterShort with Remotion...");
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  publicDir: path.resolve("public"),
});

console.log("Selecting composition LetterShort...");
const composition = await selectComposition({
  serveUrl,
  id: "LetterShort",
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

console.log("All Letter stills rendered successfully!");
