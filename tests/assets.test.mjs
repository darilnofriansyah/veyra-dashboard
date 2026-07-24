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
});
