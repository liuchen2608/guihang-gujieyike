import assert from "node:assert/strict";
import { existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { SCENE_IMAGES, sceneImageFor } from "../lib/scene-images.ts";
import type { GamePhase } from "../lib/game.ts";
import { createHash } from "node:crypto";

test("每张场景图只用于一个关键剧情节点", () => {
  const sources = Object.values(SCENE_IMAGES).map((scene) => scene.src);
  assert.equal(new Set(sources).size, sources.length);
});

test("全部二十四个剧情章节都有专属场景图", () => {
  assert.equal(Object.keys(SCENE_IMAGES).length, 24);
});

test("关键节点映射中的场景图均存在", () => {
  for (const scene of Object.values(SCENE_IMAGES)) {
    const relativePath = scene.src.replace(/^\//, "");
    assert.ok(existsSync(join(process.cwd(), "public", relativePath)), `缺少场景图：${scene.src}`);
  }
});

test("重复章节使用重新生成的专属图片", () => {
  assert.equal(SCENE_IMAGES.clan_gate.src, "/images/act1-ch03-qingsha-gate.png");
  assert.equal(SCENE_IMAGES.material_bargain.src, "/images/act3-ch03-material-bargain.png");
});

test("24 mobile images exist, are distinct WebP files, and each is below 400 KB", () => {
  const hashes = new Set<string>();
  for (const phase of Object.keys(SCENE_IMAGES) as GamePhase[]) {
    const { mobileSrc } = sceneImageFor(phase);
    assert.ok(mobileSrc);
    const file = join(process.cwd(), "public", mobileSrc);
    assert.ok(existsSync(file), file);
    assert.ok(statSync(file).size <= 400 * 1024);
    const bytes = readFileSync(file);
    assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size, 24);
});
