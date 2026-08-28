import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SCENE_IMAGES, sceneImageFor } from "../lib/scene-images.ts";

// Optional build-time tool only. Pass a local sharp module path when not installed in this project.
const sharp = createRequire(import.meta.url)(process.argv[2] || "sharp");
await mkdir("public/images/mobile", { recursive: true });
await mkdir("outputs", { recursive: true });
const thumbs = [];
const portraitThumbs = [];
for (const [index, phase] of Object.keys(SCENE_IMAGES).entries()) {
  const scene = sceneImageFor(phase);
  const source = resolve("public", `.${scene.src}`);
  const target = resolve("public", `.${scene.mobileSrc}`);
  let data;
  for (const quality of [82, 76, 70, 64]) {
    data = await sharp(source).resize({ width: 960, withoutEnlargement: true }).webp({ quality, effort: 6 }).toBuffer();
    if (data.length <= 400 * 1024) break;
  }
  if (data.length > 400 * 1024) throw new Error(`${phase}: image exceeds mobile budget`);
  await writeFile(target, data);
  thumbs.push({ input: await sharp(data).resize(320, 180, { fit: "contain", background: "#070b0c" }).toBuffer(), left: index % 4 * 320, top: Math.floor(index / 4) * 180 });
  const portrait = await sharp(data).resize({ height: 320 }).toBuffer({ resolveWithObject: true });
  const horizontalPosition = scene.mobilePosition.startsWith("center") ? 0.5 : parseFloat(scene.mobilePosition) / 100;
  const crop = await sharp(portrait.data).extract({ left: Math.round((portrait.info.width - 240) * horizontalPosition), top: 0, width: 240, height: 320 }).toBuffer();
  portraitThumbs.push({ input: crop, left: index % 4 * 240, top: Math.floor(index / 4) * 320 });
  console.log(`${String(index + 1).padStart(2, "0")} ${phase}: ${Math.round(data.length / 1024)} KB`);
}
await sharp({ create: { width: 1280, height: 1080, channels: 3, background: "#070b0c" } }).composite(thumbs).jpeg({ quality: 88 }).toFile("outputs/mobile-scenes-contact.jpg");
await sharp({ create: { width: 960, height: 1920, channels: 3, background: "#070b0c" } }).composite(portraitThumbs).jpeg({ quality: 88 }).toFile("outputs/mobile-scenes-portrait.jpg");
