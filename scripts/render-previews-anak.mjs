import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const remTmp = process.env.REMOTION_TMP || "D:/remotion-tmp";
fs.mkdirSync(remTmp, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP = remTmp;

const outDir = path.resolve("out/anakpungut/previews");
fs.mkdirSync(outDir, { recursive: true });

const browserExecutable = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chromiumOptions = { gl: "angle" };

const clips = [
  { name: "preview_1_kos", range: [150, 254] },            // wide -> macro REJECTED stamp
  { name: "preview_2_photo_falls", range: [480, 584] },     // box dig + photo falls
  { name: "preview_3_shock", range: [800, 904] },           // "Wait, is he my father?" + thought bubble
  { name: "preview_4_flip", range: [1130, 1234] },          // photo flip + Dutch tilt + record scratch
  { name: "preview_5_guard", range: [1465, 1568] },         // salute + flash
];

console.log("Bundling AnakShortWithCaptions with Remotion...");
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  publicDir: path.resolve("public"),
});

console.log("Selecting composition AnakShortWithCaptions...");
const composition = await selectComposition({
  serveUrl,
  id: "AnakShortWithCaptions",
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

console.log("All Anak Pungut preview clips rendered successfully!");
