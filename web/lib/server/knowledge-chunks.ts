export type KnowledgeSource = "world" | "thief";

export type KnowledgeChild = {
  id: string;
  label: string;
  text: string;
  searchText: string;
};

export type KnowledgeParent = {
  id: string;
  title: string;
  text: string;
  source: KnowledgeSource;
  knowledgeScope: string;
  children: KnowledgeChild[];
};

const FIELD_LABELS: Record<string, string> = {
  canon_statement: "确定事实",
  limits_and_costs: "限制与代价",
  dialogue_use: "角色对话边界",
  knowledge_scope: "知识权限",
  extreme_logic: "极端逻辑",
  director_constraint: "剧情导演约束",
  retrieval_tags: "检索标签",
  来源: "来源",
  当期可确认: "当期可确认",
  谨慎边界: "谨慎边界",
};

const FIELD_PATTERN = /^\*\*(canon_statement|limits_and_costs|dialogue_use|knowledge_scope|extreme_logic|director_constraint|retrieval_tags|来源|当期可确认|谨慎边界)\*\*\s*[：:]\s*/gm;
// These fields drive retrieval and access control. They are metadata, not lore,
// and must never be sent to the dialogue model as player-facing source text.
const NON_PROMPT_FIELDS = new Set(["knowledge_scope", "retrieval_tags", "来源"]);

function cleanSection(text: string) {
  return text
    .replace(/<!--\s*rag:child[^>]*-->/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function structuredChildren(parentId: string, title: string, body: string) {
  const matches = [...body.matchAll(FIELD_PATTERN)];
  if (!matches.length) {
    const text = cleanSection(body);
    return {
      children: text ? [{ id: `${parentId}:body`, label: "正文", text, searchText: `${title}\n${text}` }] : [],
      promptText: text,
      knowledgeScope: "",
    };
  }

  const fields = matches.map((match, index) => {
    const key = match[1];
    const start = (match.index || 0) + match[0].length;
    const end = matches[index + 1]?.index ?? body.length;
    return { key, label: FIELD_LABELS[key] || key, text: cleanSection(body.slice(start, end)) };
  });
  const tags = fields.find((field) => field.key === "retrieval_tags")?.text || "";
  const knowledgeScope = fields.find((field) => field.key === "knowledge_scope")?.text || "";
  const prefix = cleanSection(body.slice(0, matches[0].index));
  const prefixChildren: KnowledgeChild[] = prefix
    ? [{ id: `${parentId}:body`, label: "正文", text: prefix, searchText: `${title}\n${prefix}\n${tags}` }]
    : [];
  const children = [
    ...prefixChildren,
    ...fields
    .filter((field) => !NON_PROMPT_FIELDS.has(field.key) && field.text)
    .map((field) => ({
      id: `${parentId}:${field.key}`,
      label: field.label,
      text: field.text,
      searchText: `${title}\n${field.label}\n${field.text}\n${tags}`,
    })),
  ];
  const promptText = children.map((child) => `【${child.label}】${child.text}`).join("\n");
  return { children, promptText, knowledgeScope };
}

function parseMarkedParents(source: KnowledgeSource, markdown: string) {
  const markers = [...markdown.matchAll(/<!--\s*rag:(?:chunk|parent)\s+id=([A-Za-z0-9-]+)\s*-->/g)];
  return markers.flatMap((marker, index): KnowledgeParent[] => {
    const blockStart = (marker.index || 0) + marker[0].length;
    const blockEnd = markers[index + 1]?.index ?? markdown.length;
    const block = markdown.slice(blockStart, blockEnd).trim();
    const titleMatch = block.match(/^##\s+(.+)$/m);
    if (!titleMatch || titleMatch.index === undefined) return [];
    const title = titleMatch[1].trim();
    const body = block.slice(titleMatch.index + titleMatch[0].length).trim();
    const { children, promptText, knowledgeScope } = structuredChildren(marker[1], title, body);
    if (!children.length || promptText.length < 20) return [];
    return [{ id: marker[1], title, text: promptText.slice(0, 3600), source, knowledgeScope, children }];
  });
}

function parseLegacyHeadings(source: KnowledgeSource, markdown: string) {
  const chunks: KnowledgeParent[] = [];
  let title = source === "world" ? "蛊界世界观" : "盗天梦境剧情依据";
  let body: string[] = [];

  function flush() {
    const text = cleanSection(body.join("\n"));
    if (text.length >= 40) {
      const id = `${source}-${chunks.length + 1}`;
      chunks.push({
        id,
        title,
        text: text.slice(0, 3600),
        source,
        knowledgeScope: "",
        children: [{ id: `${id}:body`, label: "正文", text, searchText: `${title}\n${text}` }],
      });
    }
    body = [];
  }

  for (const line of markdown.split("\n")) {
    if (/^##?\s+/.test(line)) {
      flush();
      title = line.replace(/^#+\s+/, "").trim();
    } else {
      body.push(line);
    }
  }
  flush();
  return chunks;
}

export function parseKnowledgeParents(source: KnowledgeSource, markdown: string) {
  const marked = parseMarkedParents(source, markdown);
  return marked.length ? marked : parseLegacyHeadings(source, markdown);
}
