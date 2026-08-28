import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeNpcReply } from "../lib/server/npc-reply.ts";

test("does not expose knowledge-base field names or Markdown to the player", () => {
  const raw = [
    "我所知道的是： **canon_statement**：蛊师以空窍承载真元并驱动蛊虫。",
    "**limits_and_costs**：资质决定空窍容量，真元耗尽后战力会急跌。",
    "**dialogue_use**：本地蛊师会把这些当作常识。",
  ].join(" ");

  const result = sanitizeNpcReply(raw);

  assert.equal(
    /canon_statement|limits_and_costs|dialogue_use|\*\*/i.test(result),
    false,
    result,
  );
  assert.match(result, /蛊师以空窍承载真元/);
  assert.match(result, /真元耗尽后战力会急跌/);
});

test("keeps a normal in-character reply unchanged", () => {
  const raw = "真元就像蛊师体内的水，养在空窍里，用来催动蛊虫。";
  assert.equal(sanitizeNpcReply(raw), raw);
});

test("also removes translated prompt section names if the model echoes them", () => {
  const raw = "【确定事实】真元储存在空窍中。【限制与代价】耗尽后无法继续催动蛊虫。【角色对话边界】本地蛊师可将此视作常识。";
  const result = sanitizeNpcReply(raw);
  assert.doesNotMatch(result, /确定事实|限制与代价|角色对话边界|角色认知边界/);
  assert.match(result, /真元储存在空窍中/);
});

test("never exposes knowledge permission metadata or internal permission codes", () => {
  const raw = "我所知道的是：多只蛊按顺序配合可以形成杀招。【知识权限】概念为 experienced_gu_master；具体结构为 owner_faction_secret。";
  const result = sanitizeNpcReply(raw);

  assert.doesNotMatch(result, /知识权限|experienced_gu_master|owner_faction_secret|knowledge_scope/i);
  assert.match(result, /多只蛊按顺序配合可以形成杀招/);
});
