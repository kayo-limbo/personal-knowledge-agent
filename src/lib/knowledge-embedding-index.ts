import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "../generated/prisma/client.ts";
import {
  EMBEDDING_BATCH_SIZE, createEmbeddingChunks, embeddingDocumentHash, requestEmbeddings, describeEmbeddingFailure,
  type EmbeddingConfig, type EmbeddingDocument,
} from "./embedding.ts";
import type { KnowledgeSearchCandidate } from "./knowledge-search.ts";

type Document = EmbeddingDocument & { id: string; userId: string };
export interface EmbeddingStatus { total: number; ready: number; pending: number; failed: number; indexing: number }

/** 本模块由服务端包装层和显式运维脚本复用；不读取环境变量，不向客户端导出。 */
export async function getEmbeddingStatus(db: PrismaClient, userId: string, config: EmbeddingConfig): Promise<EmbeddingStatus> {
  const [row] = await db.$queryRaw<EmbeddingStatus[]>(Prisma.sql`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE i."modelKey" = ${config.modelKey} AND i.status = 'ready')::int AS ready,
      count(*) FILTER (WHERE i."modelKey" = ${config.modelKey} AND i.status = 'failed')::int AS failed,
      count(*) FILTER (WHERE i."modelKey" = ${config.modelKey} AND i.status = 'indexing' AND i."leaseUntil" > CURRENT_TIMESTAMP)::int AS indexing,
      count(*) FILTER (WHERE i."documentId" IS NULL OR i."modelKey" <> ${config.modelKey}
        OR (i.status = 'indexing' AND i."leaseUntil" <= CURRENT_TIMESTAMP))::int AS pending
    FROM "KnowledgeDoc" d LEFT JOIN "KnowledgeEmbeddingIndex" i ON i."documentId" = d.id
    WHERE d."userId" = ${userId}
  `);
  return row;
}

export async function indexKnowledgeDocument(
  db: PrismaClient, userId: string, documentId: string, config: EmbeddingConfig,
  signal: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<"ready" | "skipped" | "failed" | "stale"> {
  signal.throwIfAborted();
  const claimToken = randomUUID();
  // 短事务抢占租约；网络请求绝不放在持有行锁的事务中。
  const snapshot = await db.$transaction(async (tx) => {
    const [doc] = await tx.$queryRaw<Document[]>(Prisma.sql`
      SELECT id, "userId", title, content, summary, tags FROM "KnowledgeDoc"
      WHERE id = ${documentId} AND "userId" = ${userId} FOR UPDATE
    `);
    if (!doc) return null;
    const hash = embeddingDocumentHash(doc);
    const claimed = await tx.$queryRaw<{ documentId: string }[]>(Prisma.sql`
      INSERT INTO "KnowledgeEmbeddingIndex" ("documentId", "modelKey", "sourceHash", status, "claimToken", "leaseUntil")
      VALUES (${documentId}, ${config.modelKey}, ${hash}, 'indexing', ${claimToken}, CURRENT_TIMESTAMP + interval '60 seconds')
      ON CONFLICT ("documentId") DO UPDATE SET
        "modelKey" = EXCLUDED."modelKey", "sourceHash" = EXCLUDED."sourceHash", status = 'indexing',
        "claimToken" = EXCLUDED."claimToken", "leaseUntil" = EXCLUDED."leaseUntil", "updatedAt" = CURRENT_TIMESTAMP
      WHERE NOT ("KnowledgeEmbeddingIndex".status = 'ready'
        AND "KnowledgeEmbeddingIndex"."modelKey" = ${config.modelKey}
        AND "KnowledgeEmbeddingIndex"."sourceHash" = ${hash})
        AND "KnowledgeEmbeddingIndex"."leaseUntil" <= CURRENT_TIMESTAMP
      RETURNING "documentId"
    `);
    return claimed.length ? doc : null;
  });
  if (!snapshot) return "skipped";

  try {
    const chunks = createEmbeddingChunks(snapshot);
    if (!chunks.length) throw new Error("知识内容为空");
    const vectors: number[][] = [];
    for (let start = 0; start < chunks.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(start, start + EMBEDDING_BATCH_SIZE);
      vectors.push(...await requestEmbeddings(config, batch.map((chunk) => chunk.input), signal, fetcher));
    }
    signal.throwIfAborted();
    return await db.$transaction(async (tx) => {
      const [current] = await tx.$queryRaw<Document[]>(Prisma.sql`
        SELECT id, "userId", title, content, summary, tags FROM "KnowledgeDoc"
        WHERE id = ${documentId} AND "userId" = ${userId} FOR UPDATE
      `);
      if (!current || embeddingDocumentHash(current) !== embeddingDocumentHash(snapshot)) return "stale";
      const claimed = await tx.$executeRaw(Prisma.sql`
        UPDATE "KnowledgeEmbeddingIndex" SET status = 'ready', "leaseUntil" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "documentId" = ${documentId} AND "claimToken" = ${claimToken}
      `);
      if (!claimed) return "stale";
      await tx.$executeRaw(Prisma.sql`DELETE FROM "KnowledgeEmbeddingChunk" WHERE "documentId" = ${documentId}`);
      const values = chunks.map((chunk, position) => Prisma.sql`
        (${documentId}, ${position}, ${chunk.content}, ${JSON.stringify(vectors[position])}::vector)
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "KnowledgeEmbeddingChunk" ("documentId", position, content, embedding) VALUES ${Prisma.join(values)}
      `);
      return "ready";
    });
  } catch (error) {
    console.warn("knowledge.embedding.failed", { documentId, ...describeEmbeddingFailure(error) });
    // 旧任务不能覆盖新任务；失败冷却一分钟，避免连续点击触发重复收费。
    await db.$executeRaw(Prisma.sql`
      UPDATE "KnowledgeEmbeddingIndex" SET status = 'failed', "updatedAt" = CURRENT_TIMESTAMP,
        "leaseUntil" = CURRENT_TIMESTAMP + interval '60 seconds'
      WHERE "documentId" = ${documentId} AND "claimToken" = ${claimToken}
    `);
    return "failed";
  }
}

export async function rebuildKnowledgeEmbeddings(
  db: PrismaClient, userId: string, config: EmbeddingConfig, signal: AbortSignal,
  documentIds?: string[], fetcher: typeof fetch = fetch,
) {
  if (documentIds?.length === 0) return { completed: 0, attemptFailures: 0, ...await getEmbeddingStatus(db, userId, config) };
  const candidates = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT d.id FROM "KnowledgeDoc" d LEFT JOIN "KnowledgeEmbeddingIndex" i ON i."documentId" = d.id
    WHERE d."userId" = ${userId}
      ${documentIds ? Prisma.sql`AND d.id IN (${Prisma.join(documentIds)})` : Prisma.empty}
      AND (i."documentId" IS NULL OR ((i.status <> 'ready' OR i."modelKey" <> ${config.modelKey}) AND i."leaseUntil" <= CURRENT_TIMESTAMP))
    ORDER BY d.id LIMIT 20
  `);
  let completed = 0;
  let failed = 0;
  for (const { id } of candidates) {
    if (signal.aborted) break;
    const outcome = await indexKnowledgeDocument(db, userId, id, config, signal, fetcher);
    if (outcome === "ready") completed++;
    if (outcome === "failed") { failed++; break; }
  }
  return { completed, attemptFailures: failed, ...await getEmbeddingStatus(db, userId, config) };
}

export async function searchKnowledgeVectors(
  db: PrismaClient, userId: string, query: string, config: EmbeddingConfig,
  signal: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<KnowledgeSearchCandidate[]> {
  const available = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT d.id FROM "KnowledgeDoc" d JOIN "KnowledgeEmbeddingIndex" i ON i."documentId" = d.id
    WHERE d."userId" = ${userId} AND i.status = 'ready' AND i."modelKey" = ${config.modelKey} LIMIT 1
  `);
  if (!available.length) return [];
  const [vector] = await requestEmbeddings(config, [query], signal, fetcher);
  signal.throwIfAborted();
  // MATERIALIZED 先按用户和模型过滤；精确检索不会因全局近似索引过滤而丢掉本用户候选。
  return db.$queryRaw<KnowledgeSearchCandidate[]>(Prisma.sql`
    WITH owned AS MATERIALIZED (
      SELECT d.id, d.title, d.summary, d.tags, d.source, d."updatedAt", c.content, c.embedding, c.position
      FROM "KnowledgeDoc" d JOIN "KnowledgeEmbeddingIndex" i ON i."documentId" = d.id
      JOIN "KnowledgeEmbeddingChunk" c ON c."documentId" = d.id
      WHERE d."userId" = ${userId} AND i.status = 'ready' AND i."modelKey" = ${config.modelKey}
    ), scored AS (
      SELECT *, 1 - (embedding <=> ${JSON.stringify(vector)}::vector) AS similarity FROM owned
    ), best AS (
      SELECT DISTINCT ON (id) id, title, summary, tags, source, "updatedAt", content, similarity
      FROM scored WHERE similarity >= ${config.minSimilarity}
      ORDER BY id, similarity DESC, position
    ) SELECT id, title, summary, tags, source, "updatedAt", content, similarity AS "semanticSimilarity" FROM best ORDER BY similarity DESC, id LIMIT 40
  `);
}
