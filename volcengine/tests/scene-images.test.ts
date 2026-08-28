import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { SCENE_IMAGES } from "../lib/scene-images.ts";

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
