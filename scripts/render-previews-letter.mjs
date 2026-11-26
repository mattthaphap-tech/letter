import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const remTmp = process.env.REMOTION_TMP || "D:/remotion-tmp";
fs.mkdirSync(remTmp, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP = remTmp;

const outDir = path.resolve("out/letter/previews");
fs.mkdirSync(outDir, { recursive: true });

const browserExecutable = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chromiumOptions = { gl: "angle" };

const clips = [
  { name: "preview_1_envelope", range: [0, 104] },          // macro envelope -> Sarah in the old house
  { name: "preview_2_book", range: [340, 444] },            // the favourite book + the yellow envelope
  { name: "preview_3_reveal", range: [680, 784] },          // the letter: not her real father
  { name: "preview_4_1951", range: [800, 904] },            // orchard: Mary meets Thomas
  { name: "preview_5_ending", range: [1620, 1724] },        // kitchen table, golden hour
];

console.log("Bundling LetterShortWithCaptions with Remotion...");
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  publicDir: path.resolve("public"),
});

console.log("Selecting composition LetterShortWithCaptions...");
const composition = await selectComposition({
  serveUrl,
  id: "LetterShortWithCaptions",
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

console.log("All Letter preview clips rendered successfully!");
