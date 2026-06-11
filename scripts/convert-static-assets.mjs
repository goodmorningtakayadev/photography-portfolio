// One-off conversion of hand-placed static assets to webp.
// aurora: heavily blurred glow layer — q90 is visually identical to the PNG.
// about portrait: rendered ≤458px wide (≤420 mobile); 1000px covers 2x DPR.
import sharp from "sharp";

const aurora = await sharp("public/hero/aurora.png")
  .webp({ quality: 90 })
  .toFile("public/hero/aurora.webp");
console.log("aurora.webp:", Math.round(aurora.size / 1024), "KB");

const portrait = await sharp("public/photos/japan-bw-4.jpg")
  .resize({ width: 1000, withoutEnlargement: true })
  .webp({ quality: 85 })
  .toFile("public/about/portrait.webp");
console.log("portrait.webp:", Math.round(portrait.size / 1024), "KB");
