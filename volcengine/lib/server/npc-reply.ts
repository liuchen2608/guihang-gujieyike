const INTERNAL_FIELD_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\*{0,2}\s*canon_statement\s*\*{0,2}\s*[：:]?/gi, ""],
  [/\*{0,2}\s*limits_and_costs\s*\*{0,2}\s*[：:]?/gi, "不过，"],
  [/\*{0,2}\s*dialogue_use\s*\*{0,2}\s*[：:]?/gi, "一般来说，"],
  [/【?\s*确定事实\s*】?\s*[：:]?/g, ""],
  [/【?\s*限制与代价\s*】?\s*[：:]?/g, "不过，"],
  [/【?\s*角色(?:认知|对话)边界\s*】?\s*[：:]?/g, "一般来说，"],
];

export function prepareKnowledgeForPrompt(text: string) {
  return text
    .replace(/\*{0,2}\s*canon_statement\s*\*{0,2}\s*[：:]?/gi, "【确定事实】")
    .replace(/\*{0,2}\s*limits_and_costs\s*\*{0,2}\s*[：:]?/gi, "【限制与代价】")
    .replace(/\*{0,2}\s*dialogue_use\s*\*{0,2}\s*[：:]?/gi, "【角色认知边界】")
    .replace(/\*\*/g, "")
    .trim();
}

export function sanitizeNpcReply(value: string) {
  let text = value.trim();

  // RAG access-control data is useful to the server, but is never dialogue.
  // Remove the entire metadata tail before cleaning ordinary section labels.
  text = text
    .replace(/[【[]\s*知识权限\s*[】\]][^\n]*/gi, "")
    .replace(/^.*\bknowledge_scope\b.*$/gim, "")
    .replace(/(?:概念为|具体结构为|权限(?:范围)?为)\s*[；;，,。]?/g, "");

  for (const [pattern, replacement] of INTERNAL_FIELD_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/gi, "");

  return text
    .replace(/^```(?:json|markdown|md|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^\[资料\s*\d+[^\]]*\]\s*/gim, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^(?:乌岩|归航|青砂族老|未婚妻记忆|盗天意志)\s*[：:]\s*/i, "")
    .replace(/不过，[，；。\s]*/g, "不过，")
    .replace(/一般来说，[，；。\s]*/g, "一般来说，")
    .replace(/[；;]\s*[；;，,。]/g, "。")
    .replace(/(?:[：:，,；;]\s*)+$/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
