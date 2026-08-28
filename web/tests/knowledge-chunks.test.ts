import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseKnowledgeParents } from "../lib/server/knowledge-chunks.ts";

test("splits one rule into searchable children and returns a clean parent", () => {
  const markdown = `
<!-- rag:parent id=RULE-POWER -->
## RULE-01｜空窍与真元

<!-- rag:child key=canon_statement -->
**canon_statement**：蛊师以空窍承载真元并驱动蛊虫。

<!-- rag:child key=limits_and_costs -->
**limits_and_costs**：真元耗尽后战力会急跌。

<!-- rag:child key=knowledge_scope -->
**knowledge_scope**：普通蛊师常识。

<!-- rag:child key=retrieval_tags -->
**retrieval_tags**：真元, 空窍, 蛊师

<!-- rag:child key=来源 -->
**来源**：第475章。
`;

  const [parent] = parseKnowledgeParents("world", markdown);
  assert.equal(parent.id, "RULE-POWER");
  assert.deepEqual(parent.children.map((child) => child.label), ["确定事实", "限制与代价"]);
  assert.match(parent.children[0].searchText, /真元, 空窍, 蛊师/);
  assert.match(parent.text, /蛊师以空窍承载真元/);
  assert.match(parent.text, /真元耗尽后战力会急跌/);
  assert.doesNotMatch(parent.text, /canon_statement|limits_and_costs|knowledge_scope|知识权限|普通蛊师常识|retrieval_tags|第475章/);
});

test("keeps unlabelled safety content before a source field", () => {
  const markdown = `
<!-- rag:parent id=SAFETY-FUTURE -->
## SAFETY-01｜未来记忆隔离

方源的前世记忆不是当前时期的公共事实。

<!-- rag:child key=来源 -->
**来源**：第490章。
`;

  const [parent] = parseKnowledgeParents("world", markdown);
  assert.equal(parent.children[0].label, "正文");
  assert.match(parent.text, /不是当前时期的公共事实/);
  assert.doesNotMatch(parent.text, /第490章/);
});

test("retains heading-based fallback for the thief story document", () => {
  const markdown = "# 盗天梦境\n\n总说明。\n\n## 回家动机\n\n本杰孙始终寻找返回故乡的方法，也因此愿意忍受漫长的孤独与痛苦，但不会轻易相信毫无代价的归乡之门。";
  const parents = parseKnowledgeParents("thief", markdown);
  assert.equal(parents.at(-1)?.title, "回家动机");
  assert.match(parents.at(-1)?.text || "", /返回故乡/);
});

test("parses every parent in the production world document", () => {
  const document = readFileSync(new URL("../rag/蛊界世界观-北原历史时期-469至490章.md", import.meta.url), "utf8");
  const parents = parseKnowledgeParents("world", document);
  const powerRule = parents.find((parent) => parent.id === "RULE-POWER-RANKS");

  assert.equal(parents.length, 21);
  assert.deepEqual(powerRule?.children.map((child) => child.label), ["确定事实", "限制与代价", "角色对话边界"]);
  assert.doesNotMatch(powerRule?.text || "", /retrieval_tags|knowledge_scope|知识权限|github\.com|canon_statement/);
});
