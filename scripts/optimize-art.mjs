import sharp from "sharp";

await sharp("public/assets/veyra-dashboard-portrait.png")
  .resize({ width: 800, height: 1000, fit: "inside", withoutEnlargement: true })
  .webp({ quality: 88, alphaQuality: 100 })
  .toFile("public/assets/veyra-dashboard-portrait.webp");
