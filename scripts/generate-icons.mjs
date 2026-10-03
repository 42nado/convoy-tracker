// Uses the image library bundled with Next.js. Run from the project root.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0f172a"/><g fill="none" stroke="#fb923c" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"><path d="m160 390 56-268h80l56 268"/><path d="M252 178h8m-12 75h16m-20 75h24"/></g></svg>`);
await mkdir("public/icons", { recursive: true });
for (const [file, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["icon-maskable-512.png", 512], ["apple-touch-icon.png", 180]]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icons/${file}`);
}
