import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  MAX_KNOWLEDGE_CANDIDATES,
  createKnowledgeSearchWhere,
  extractFullTextTerms,
  extractKnowledgeKeywords,
  rankKnowledgeCandidates,
  type KnowledgeSearchResult,
} from "@/lib/knowledge-search";

interface FullTextKnowledgeCandidate {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  tags: string | null;
  source: string | null;
  updatedAt: Date;
  fullTextRank: number;
}

/**
 * 固定知识检索入口。userId 只能由调用方从 Session 传入，不能来自浏览器请求体。
 */
export async function searchKnowledge(
  userId: string,
  query: string
): Promise<KnowledgeSearchResult[]> {
  const keywords = extractKnowledgeKeywords(query);
  if (keywords.length === 0) return [];

  const fullTextTerms = extractFullTextTerms(keywords);
  const [keywordCandidates, fullTextCandidates] = await Promise.all([
    prisma.knowledgeDoc.findMany({
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
    }),
    fullTextTerms.length === 0
      ? Promise.resolve([] as FullTextKnowledgeCandidate[])
      : searchPostgresFullText(userId, fullTextTerms),
  ]);

  const merged = new Map<string, FullTextKnowledgeCandidate>();
  for (const candidate of keywordCandidates) {
    merged.set(candidate.id, { ...candidate, fullTextRank: 0 });
  }
  for (const candidate of fullTextCandidates) {
    const current = merged.get(candidate.id);
    merged.set(candidate.id, {
      ...candidate,
      fullTextRank: Math.max(current?.fullTextRank ?? 0, Number(candidate.fullTextRank) || 0),
    });
  }

  return rankKnowledgeCandidates([...merged.values()], keywords);
}

/**
 * 参数通过 Prisma tagged template 绑定，不能被拼接成 SQL；userId 仍是硬性过滤条件。
 * 这里按请求即时构造 tsvector，避免验收版新增索引迁移；数据量扩大后再升级生成列/GiN 索引。
 */
async function searchPostgresFullText(
  userId: string,
  terms: string[]
): Promise<FullTextKnowledgeCandidate[]> {
  const webSearchQuery = terms.join(" OR ");
  return prisma.$queryRaw<FullTextKnowledgeCandidate[]>(Prisma.sql`
    WITH search_query AS (
      SELECT websearch_to_tsquery('simple', ${webSearchQuery}) AS query
    ), ranked AS (
      SELECT
        document."id",
        document."title",
        document."content",
        document."summary",
        document."tags",
        document."source",
        document."updatedAt",
        ts_rank_cd(
          setweight(to_tsvector('simple', coalesce(document."title", '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(document."tags", '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(document."summary", '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(document."content", '')), 'D'),
          search_query.query
        )::double precision AS "fullTextRank"
      FROM "KnowledgeDoc" AS document
      CROSS JOIN search_query
      WHERE document."userId" = ${userId}
        AND (
          setweight(to_tsvector('simple', coalesce(document."title", '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(document."tags", '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(document."summary", '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(document."content", '')), 'D')
        ) @@ search_query.query
    )
    SELECT * FROM ranked
    ORDER BY "fullTextRank" DESC, "updatedAt" DESC
    LIMIT ${MAX_KNOWLEDGE_CANDIDATES}
  `);
}
