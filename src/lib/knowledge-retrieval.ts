import { Prisma, type PrismaClient } from "../generated/prisma/client.ts";
import {
  MAX_KNOWLEDGE_CANDIDATES,
  createKnowledgeSearchWhere,
  extractFullTextTerms,
  extractKnowledgeKeywords,
  sortKnowledgeCandidates,
  fuseKnowledgeCandidates,
  formatKnowledgeCandidates,
  type KnowledgeSearchResult,
  type KnowledgeSearchCandidate,
} from "./knowledge-search.ts";

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
export async function retrieveKnowledge(
  prisma: PrismaClient,
  userId: string,
  query: string,
  semanticSearch: () => Promise<KnowledgeSearchCandidate[]> = async () => [],
): Promise<{ lexical: KnowledgeSearchResult[]; hybrid: KnowledgeSearchResult[] }> {
  const keywords = extractKnowledgeKeywords(query);
  if (!query.trim()) return { lexical: [], hybrid: [] };

  const fullTextTerms = extractFullTextTerms(keywords);
  const [keywordCandidates, fullTextCandidates, semanticCandidates] = await Promise.all([
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
      : searchPostgresFullText(prisma, userId, fullTextTerms),
    semanticSearch(),
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

  const lexical = sortKnowledgeCandidates([...merged.values()], keywords);
  return {
    lexical: formatKnowledgeCandidates(lexical, keywords),
    hybrid: formatKnowledgeCandidates(fuseKnowledgeCandidates(lexical, semanticCandidates), keywords),
  };
}

/**
 * 参数通过 Prisma tagged template 绑定，不能被拼接成 SQL；userId 仍是硬性过滤条件。
 * 这里按请求即时构造 tsvector，避免验收版新增索引迁移；数据量扩大后再升级生成列/GiN 索引。
 */
async function searchPostgresFullText(
  prisma: PrismaClient,
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
