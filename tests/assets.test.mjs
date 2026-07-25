import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

test("keeps dashboard artwork production-ready", async () => {
  const png = await sharp("public/assets/veyra-dashboard-portrait.png").metadata();
  assert.ok(png.width >= 1600);
  assert.ok(png.height >= 2000);
  assert.equal(png.hasAlpha, true);

  const webpPath = "public/assets/veyra-dashboard-portrait.webp";
  assert.equal(existsSync(webpPath), true, "WebP portrait must exist");
  const webp = await sharp(webpPath).metadata();
  assert.ok(webp.width <= 800);
  assert.equal(webp.hasAlpha, true);

  for (const path of ["public/assets/veyra-logo.png", "public/assets/veyra-mark.png"]) {
    assert.ok((await stat(path)).size > 0, `${path} must not be empty`);
  }

  const logo = await sharp("public/assets/veyra-logo.png").metadata();
  assert.ok(logo.width / logo.height > 4, "logo lockup should be cropped to its visible artwork");
});

test("keeps login line art production-ready", async () => {
  const path = "public/assets/veyra-login-line-art.webp";
  assert.equal(existsSync(path), true, "login line art must exist");

  const artwork = await sharp(path).metadata();
  assert.ok(artwork.width >= 1000, "login line art must support desktop placement");
  assert.ok(artwork.height >= 1400, "login line art must support portrait placement");
  assert.equal(artwork.hasAlpha, true, "login line art must keep transparency");
  assert.ok((await stat(path)).size < 700_000, "login line art must stay optimized");

  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const padding = 64;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (x >= padding && x < info.width - padding && y >= padding && y < info.height - padding) continue;
      assert.equal(data[(y * info.width + x) * info.channels + 3], 0, "login line art needs transparent padding");
    }
  }
});
