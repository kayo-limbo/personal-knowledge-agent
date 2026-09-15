import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { readEmbeddingConfig } from "../src/lib/embedding.ts";
import { getEmbeddingStatus, indexKnowledgeDocument, searchKnowledgeVectors } from "../src/lib/knowledge-embedding-index.ts";
import { retrieveKnowledge } from "../src/lib/knowledge-retrieval.ts";

const connectionString = process.env.EMBEDDING_TEST_DATABASE_URL;
const config = readEmbeddingConfig({ EMBEDDING_API_KEY: "test-only", EMBEDDING_BASE_URL: "https://example.test/v1" })!;
const fakeFetch: typeof fetch = async (_url, options) => {
  const { input } = JSON.parse(String(options?.body)) as { input: string[] };
  return Response.json({ data: input.map((_, index) => ({ index, embedding: [1, ...Array(1023).fill(0)] })) });
};

test("真实 pgvector：隔离、幂等、更新失效、失败恢复、并发租约、旧任务防覆盖和级联删除", { skip: !connectionString }, async () => {
  const url = new URL(connectionString!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "集成测试只允许显式本机测试库");
  assert.ok(url.pathname.endsWith("_embedding_test"), "数据库名称必须以 _embedding_test 结尾");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 4 }) });
  const suffix = randomUUID();
  const users = [`embedding-a-${suffix}`, `embedding-b-${suffix}`];
  const signal = () => AbortSignal.timeout(10_000);
  try {
    await db.user.createMany({ data: users.map((id) => ({ id, email: `${id}@example.test`, passwordHash: "disabled-test-account" })) });
    const a = await db.knowledgeDoc.create({ data: { userId: users[0], title: "机制记录", content: "AbortController 中断上游请求并节省 token。" } });
    const b = await db.knowledgeDoc.create({ data: { userId: users[1], title: "私有资料", content: "不能泄露" } });
    assert.equal(await indexKnowledgeDocument(db, users[1], a.id, config, signal(), fakeFetch), "skipped");
    assert.equal(await indexKnowledgeDocument(db, users[0], a.id, config, signal(), fakeFetch), "ready");
    assert.equal(await indexKnowledgeDocument(db, users[1], b.id, config, signal(), fakeFetch), "ready");
    assert.equal(await indexKnowledgeDocument(db, users[0], a.id, config, signal(), async () => { throw new Error("不应重复请求"); }), "skipped");
    const search = () => searchKnowledgeVectors(db, users[0], "让模型别继续生成", config, signal(), fakeFetch);
    assert.deepEqual((await search()).map((row) => row.id), [a.id]);
    const results = await retrieveKnowledge(db, users[0], "让模型别继续生成", search);
    assert.equal(results.lexical.length, 0);
    assert.equal(results.hybrid[0].id, a.id);
    assert.deepEqual((await retrieveKnowledge(db, users[0], "AbortController")).hybrid.map((row) => row.id), [a.id]);
    assert.equal((await getEmbeddingStatus(db, users[0], { ...config, modelKey: "other" })).ready, 0);
    assert.deepEqual(await searchKnowledgeVectors(db, users[0], "问题", { ...config, modelKey: "other" }, signal(), fakeFetch), []);

    await db.knowledgeDoc.update({ where: { id: a.id }, data: { content: "修改后的材料" } });
    assert.deepEqual(await search(), []);
    assert.equal((await getEmbeddingStatus(db, users[0], config)).pending, 1);
    assert.equal(await indexKnowledgeDocument(db, users[0], a.id, config, signal(), async () => new Response("error", { status: 429 })), "failed");
    assert.equal((await getEmbeddingStatus(db, users[0], config)).failed, 1);
    assert.equal(await indexKnowledgeDocument(db, users[0], a.id, config, signal(), fakeFetch), "skipped");
    await db.$executeRaw(Prisma.sql`UPDATE "KnowledgeEmbeddingIndex" SET "leaseUntil" = CURRENT_TIMESTAMP - interval '1 second' WHERE "documentId" = ${a.id}`);
    assert.equal(await indexKnowledgeDocument(db, users[0], a.id, config, signal(), fakeFetch), "ready");

    await db.knowledgeDoc.update({ where: { id: a.id }, data: { content: "开始并发验证" } });
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const delayed: typeof fetch = async (...args) => { entered(); await gate; return fakeFetch(...args); };
    const oldJob = indexKnowledgeDocument(db, users[0], a.id, config, signal(), delayed);
    await started;
    assert.equal(await indexKnowledgeDocument(db, users[0], a.id, config, signal(), fakeFetch), "skipped");
    await db.knowledgeDoc.update({ where: { id: a.id }, data: { content: "最新资料优先" } });
    assert.equal(await indexKnowledgeDocument(db, users[0], a.id, config, signal(), fakeFetch), "ready");
    release();
    assert.equal(await oldJob, "stale");
    assert.equal((await search())[0].content, "最新资料优先");

    await db.knowledgeDoc.delete({ where: { id: a.id } });
    assert.deepEqual(await search(), []);
    const [count] = await db.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT count(*)::int AS count FROM "KnowledgeEmbeddingChunk" WHERE "documentId" = ${a.id}`);
    assert.equal(count.count, 0);
  } finally {
    await db.knowledgeDoc.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
