import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { readEmbeddingConfig } from "../src/lib/embedding.ts";
import { getEmbeddingStatus, rebuildKnowledgeEmbeddings, searchKnowledgeVectors } from "../src/lib/knowledge-embedding-index.ts";
import { retrieveKnowledge } from "../src/lib/knowledge-retrieval.ts";

loadEnvConfig(process.cwd());
const [mode, userId, evaluationPath] = process.argv.slice(2);
if (!["status", "rebuild", "evaluate"].includes(mode) || !userId || (mode === "evaluate" && !evaluationPath)) {
  throw new Error("用法：npm run knowledge:embeddings -- status|rebuild|evaluate <userId> [问题集.json]");
}
const config = readEmbeddingConfig(process.env);
if (!config) throw new Error("请先在本地环境配置 EMBEDDING_API_KEY、EMBEDDING_BASE_URL");
if (!process.env.DATABASE_URL) throw new Error("缺少 DATABASE_URL");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 2 }) });
try {
  if (!await db.user.findUnique({ where: { id: userId }, select: { id: true } })) throw new Error("指定用户不存在");
  if (mode === "status") console.log(JSON.stringify(await getEmbeddingStatus(db, userId, config), null, 2));
  if (mode === "rebuild") console.log(JSON.stringify(await rebuildKnowledgeEmbeddings(db, userId, config, AbortSignal.timeout(25_000)), null, 2));
  if (mode === "evaluate") {
    const cases = z.array(z.object({ query: z.string().trim().min(1).max(500), expectedIds: z.array(z.string().min(1)) })).min(1).max(100)
      .parse(JSON.parse(await readFile(evaluationPath, "utf8")));
    const status = await getEmbeddingStatus(db, userId, config);
    if (status.ready !== status.total) throw new Error("请先完成该用户全部索引，再进行检索评测");
    const expectedIds = [...new Set(cases.flatMap((entry) => entry.expectedIds))];
    const owned = await db.knowledgeDoc.count({ where: { userId, id: { in: expectedIds } } });
    if (owned !== expectedIds.length) throw new Error("问题集含不存在或不属于该用户的知识 ID");
    const report = [];
    for (const entry of cases) {
      const start = performance.now();
      const result = await retrieveKnowledge(db, userId, entry.query,
        () => searchKnowledgeVectors(db, userId, entry.query, config, AbortSignal.timeout(2500)));
      const score = (ids: string[]) => entry.expectedIds.length
        ? { hitAt5: Number(ids.some((id) => entry.expectedIds.includes(id))), recallAt5: entry.expectedIds.filter((id) => ids.includes(id)).length / entry.expectedIds.length }
        : { emptyCorrect: ids.length === 0 };
      report.push({ query: entry.query, milliseconds: Math.round(performance.now() - start),
        lexical: { ids: result.lexical.map((row) => row.id), ...score(result.lexical.map((row) => row.id)) },
        hybrid: { ids: result.hybrid.map((row) => row.id), ...score(result.hybrid.map((row) => row.id)) } });
    }
    // 评测严格暴露服务失败，不能把悄悄降级的结果当作向量效果。
    console.log(JSON.stringify({ model: config.model, modelKey: config.modelKey, status, report }, null, 2));
  }
} finally { await db.$disconnect(); }
