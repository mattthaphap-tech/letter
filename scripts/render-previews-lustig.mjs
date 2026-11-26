import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const remTmp = process.env.REMOTION_TMP || "D:/remotion-tmp";
fs.mkdirSync(remTmp, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP = remTmp;

const outDir = path.resolve("out/lustig/previews");
fs.mkdirSync(outDir, { recursive: true });

const browserExecutable = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chromiumOptions = { gl: "angle" };

const clips = [
  { name: "preview_1_hook", range: [0, 104] },              // SOLD! + "Twice."
  { name: "preview_2_car_tour", range: [306, 410] },        // government car tour
  { name: "preview_3_bribe", range: [540, 644] },           // Poisson + the bribe
  { name: "preview_4_contract_tower", range: [740, 844] },  // contract stamp -> rusting tower
  { name: "preview_5_arrest_cell", range: [1440, 1543] },   // handcuffs -> cell -> flash
];

console.log("Bundling LustigShortWithCaptions with Remotion...");
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  publicDir: path.resolve("public"),
});

console.log("Selecting composition LustigShortWithCaptions...");
const composition = await selectComposition({
  serveUrl,
  id: "LustigShortWithCaptions",
  browserExecutable,
  chromiumOptions,
});

for (const clip of clips) {
  const t0 = Date.now();
  const outputLocation = path.join(outDir, `${clip.name}.mp4`);
  console.log(`Rendering ${clip.name} (frames ${clip.range[0]}..${clip.range[1]}) -> ${outputLocation}...`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    frameRange: clip.range,
    scale: 0.5,
    crf: 20,
    concurrency: 2,
    browserExecutable,
    chromiumOptions,
    timeoutInMilliseconds: 120000,
  });
  console.log(`Finished ${clip.name} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

console.log("All Lustig preview clips rendered successfully!");
