import worldKnowledge from "@/rag/蛊界世界观-北原历史时期-469至490章.md?raw";
import thiefKnowledge from "@/rag/盗天梦境-第五卷469至490章.md?raw";
import { GameState, NpcId, stageInfo } from "@/lib/game";
import { KnowledgeParent, parseKnowledgeParents } from "@/lib/server/knowledge-chunks";

export type KnowledgeHit = {
  id: string;
  title: string;
  text: string;
  score: number;
  source: "world" | "thief";
};

const STOP_WORDS = new Set(["什么", "怎么", "为什么", "是否", "可以", "这个", "那个", "这里", "那里", "你们", "我们", "他们", "玩家", "问题", "事情", "知道", "告诉", "一下"]);

const KNOWLEDGE_CHUNKS = [
  ...parseKnowledgeParents("world", worldKnowledge),
  ...parseKnowledgeParents("thief", thiefKnowledge),
];

function termsFor(text: string) {
  const terms = new Set<string>();
  const normalized = text.toLowerCase().replace(/[，。！？、；：“”‘’（）【】《》,.!?;:'"()[\]{}]/g, " ");
  for (const word of normalized.match(/[a-z0-9_-]{2,}|[\u3400-\u9fff]{2,8}/g) || []) {
    if (!STOP_WORDS.has(word)) terms.add(word);
    if (/^[\u3400-\u9fff]+$/.test(word)) {
      for (let size = 2; size <= Math.min(4, word.length); size += 1) {
        for (let index = 0; index <= word.length - size; index += 1) {
          const gram = word.slice(index, index + size);
          if (!STOP_WORDS.has(gram)) terms.add(gram);
        }
      }
    }
  }
  return [...terms];
}

function allowedForSpeaker(chunk: KnowledgeParent, npcId: NpcId) {
  if (/GENERATION-CONTRACT|推荐检索字段|建议检索优先级|审校状态|来源索引/.test(chunk.title)) return false;
  if (npcId === "fiancee_memory") return chunk.source === "thief" && /本杰孙|机甲|回家|改编约束/.test(`${chunk.title}\n${chunk.text}`);
  if (npcId === "thief_will" || npcId === "guihang") return true;
  if (chunk.source === "thief") return false;
  if (/ACCESS-02|ACCESS-03|第二空窍|黄金血脉|真阳楼/.test(chunk.title)) return false;
  if (npcId === "wuyan" || npcId === "clan_guard") return !/宝黄天|福地|魂魄|高层秘密/.test(`${chunk.title}\n${chunk.text}`);
  return !/第二空窍/.test(`${chunk.title}\n${chunk.text}`);
}

export function rewriteKnowledgeQuery(state: GameState, npcId: NpcId, input: string) {
  const stage = stageInfo(state.phase);
  const region = state.act === 1
    ? "西漠青砂部族"
    : state.act === 2
      ? "盗天梦境西漠历史"
      : "西漠青砂部族 蛊机外骨骼 真元机甲接口";
  return `${region} ${stage.title} ${npcId} ${input}`.slice(0, 700);
}

export function retrieveKnowledge(state: GameState, npcId: NpcId, input: string, limit = 4): KnowledgeHit[] {
  const rewritten = rewriteKnowledgeQuery(state, npcId, input);
  const primaryTerms = termsFor(input);
  const contextTerms = termsFor(rewritten).filter((term) => !primaryTerms.includes(term));
  const thiefBias = /盗天|本杰孙|归乡|机甲|天外之魔|梦境|偷道/.test(rewritten);
  const worldBias = /蛊|空窍|真元|蛊师|部族|北原|西漠|福地|宝黄天|魂魄|正道|魔道|战斗|杀招/.test(rewritten);

  return KNOWLEDGE_CHUNKS
    .filter((chunk) => allowedForSpeaker(chunk, npcId))
    .map((chunk) => {
      const title = chunk.title.toLowerCase();
      const childScores = chunk.children.map((child) => {
        const haystack = child.searchText.toLowerCase();
        let primaryScore = 0;
        let contextScore = 0;
        for (const term of primaryTerms) {
          if (haystack.includes(term)) primaryScore += term.length >= 4 ? 6 : 2;
          if (title.includes(term)) primaryScore += 5;
        }
        for (const term of contextTerms) {
          if (haystack.includes(term)) contextScore += 0.2;
        }
        // Stage context may break ties, but it cannot create a hit by itself.
        // This prevents generic words from the rewritten query from returning
        // an unrelated lore rule when the player's original text has no match.
        return primaryScore > 0 ? primaryScore + Math.min(contextScore, 2) : 0;
      });
      let score = Math.max(0, ...childScores);
      if (score > 0 && thiefBias && chunk.source === "thief") score += 6;
      if (score > 0 && worldBias && chunk.source === "world") score += 3;
      return { id: chunk.id, title: chunk.title, text: chunk.text, source: chunk.source, score };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
