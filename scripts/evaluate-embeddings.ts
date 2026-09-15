import nextEnv from "@next/env";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { readEmbeddingConfig } from "../src/lib/embedding.ts";
import { getEmbeddingStatus, rebuildKnowledgeEmbeddings, searchKnowledgeVectors } from "../src/lib/knowledge-embedding-index.ts";
import { retrieveKnowledge } from "../src/lib/knowledge-retrieval.ts";

nextEnv.loadEnvConfig(process.cwd());
const config = readEmbeddingConfig(process.env);
if (!config) throw new Error("缺少 Embedding 配置");
const connectionString = process.env.EMBEDDING_EVAL_DATABASE_URL;
if (!connectionString) throw new Error("请显式配置 EMBEDDING_EVAL_DATABASE_URL（仅允许本机独立测试库）");
const url = new URL(connectionString);
if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_embedding_test")) {
  throw new Error("只能对本机 _embedding_test 后缀的数据库执行合成资料评测");
}
const fixture = z.object({
  documents: z.array(z.object({ key: z.string(), title: z.string(), content: z.string() })).max(20),
  cases: z.array(z.object({ query: z.string().max(500), expectedKeys: z.array(z.string()) })).max(40),
}).parse(JSON.parse(await readFile(new URL("../tests/fixtures/embedding-evaluation.json", import.meta.url), "utf8")));
const keys = new Set(fixture.documents.map((doc) => doc.key));
if (keys.size !== fixture.documents.length || fixture.cases.some((entry) => entry.expectedKeys.some((key) => !keys.has(key)))) {
  throw new Error("评测数据的知识 key 重复或引用不存在");
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 4 }) });
const userId = `embedding-eval-${randomUUID()}`;
let requests = 0;
let tokens = 0;
const capture: typeof fetch = async (...args) => {
  requests++;
  const response = await fetch(...args);
  if (response.ok) {
    const payload = await response.clone().json();
    tokens += Number(payload.usage?.total_tokens ?? 0);
  }
  return response;
};
try {
  await db.user.create({ data: { id: userId, email: `${userId}@example.test`, passwordHash: "disabled-evaluation-account" } });
  await db.knowledgeDoc.createMany({ data: fixture.documents.map((doc) => ({ id: `${userId}-${doc.key}`, userId, title: doc.title, content: doc.content, source: "manual" })) });
  await rebuildKnowledgeEmbeddings(db, userId, config, AbortSignal.timeout(25_000), undefined, capture);
  const status = await getEmbeddingStatus(db, userId, config);
  if (status.ready !== fixture.documents.length) throw new Error(`索引未全部完成：${status.ready}/${status.total}`);
  const report = [];
  for (const entry of fixture.cases) {
    let vectorMilliseconds = 0;
    const start = performance.now();
    const result = await retrieveKnowledge(db, userId, entry.query, async () => {
      const vectorStart = performance.now();
      const candidates = await searchKnowledgeVectors(db, userId, entry.query, config, AbortSignal.timeout(2500), capture);
      vectorMilliseconds = Math.round(performance.now() - vectorStart);
      return candidates;
    });
    const project = (rows: typeof result.hybrid) => {
      const resultKeys = rows.map((row) => row.id.slice(userId.length + 1));
      const rank = resultKeys.findIndex((key) => entry.expectedKeys.includes(key)) + 1;
      return { keys: resultKeys, hitAt1: rank === 1, hitAt5: rank > 0, reciprocalRank: rank ? 1 / rank : 0, emptyCorrect: entry.expectedKeys.length === 0 && resultKeys.length === 0 };
    };
    report.push({ ...entry, milliseconds: Math.round(performance.now() - start), vectorMilliseconds, lexical: project(result.lexical), hybrid: project(result.hybrid) });
  }
  const answerable = report.filter((row) => row.expectedKeys.length);
  const unanswerable = report.filter((row) => !row.expectedKeys.length);
  const summary = (mode: "lexical" | "hybrid") => ({
    hitAt1: answerable.filter((row) => row[mode].hitAt1).length / answerable.length,
    hitAt5: answerable.filter((row) => row[mode].hitAt5).length / answerable.length,
    mrrAt5: answerable.reduce((sum, row) => sum + row[mode].reciprocalRank, 0) / answerable.length,
    emptyCorrect: unanswerable.filter((row) => row[mode].emptyCorrect).length,
    unanswerableCount: unanswerable.length,
  });
  const result = { evaluatedAt: new Date().toISOString(), model: config.model, dimensions: 1024, minSimilarity: config.minSimilarity,
    corpus: "公开合成的 12 条知识，16 道有答案问题与 4 道无答案问题；不能代表真实用户资料整体质量", requests, tokens,
    averageMilliseconds: Math.round(report.reduce((sum, row) => sum + row.milliseconds, 0) / report.length),
    lexical: summary("lexical"), hybrid: summary("hybrid"), report };
  const output = process.argv[2];
  if (output) await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ ...result, report: undefined }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ success: false, message: error instanceof Error ? error.message : "评测失败", requests, tokens }));
  process.exitCode = 1;
} finally {
  await db.knowledgeDoc.deleteMany({ where: { userId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
}
