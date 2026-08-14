import "server-only";

import { prisma } from "@/lib/prisma";
import {
  MAX_KNOWLEDGE_CANDIDATES,
  createKnowledgeSearchWhere,
  extractKnowledgeKeywords,
  rankKnowledgeCandidates,
  type KnowledgeSearchResult,
} from "@/lib/knowledge-search";

/**
 * 固定知识检索入口。userId 只能由调用方从 Session 传入，不能来自浏览器请求体。
 */
export async function searchKnowledge(
  userId: string,
  query: string
): Promise<KnowledgeSearchResult[]> {
  const keywords = extractKnowledgeKeywords(query);
  if (keywords.length === 0) return [];

  const candidates = await prisma.knowledgeDoc.findMany({
    where: createKnowledgeSearchWhere(userId, keywords),
    orderBy: { updatedAt: "desc" },
    take: MAX_KNOWLEDGE_CANDIDATES,
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      tags: true,
      source: true,
      updatedAt: true,
    },
  });

  return rankKnowledgeCandidates(candidates, keywords);
}
