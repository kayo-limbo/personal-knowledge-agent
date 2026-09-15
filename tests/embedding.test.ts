import assert from "node:assert/strict";
import test from "node:test";
import {
  EMBEDDING_DIMENSIONS, createEmbeddingChunks, readEmbeddingConfig,
  parseEmbeddingResponse, requestEmbeddings, embeddingDocumentHash,
} from "../src/lib/embedding.ts";
import {
  formatKnowledgeCandidates, fuseKnowledgeCandidates, MAX_KNOWLEDGE_CONTEXT_CHARACTERS,
  type KnowledgeSearchCandidate,
} from "../src/lib/knowledge-search.ts";

const vector = (axis = 0) => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => index === axis ? 1 : 0);
const config = readEmbeddingConfig({ EMBEDDING_API_KEY: "test-secret", EMBEDDING_BASE_URL: "https://example.test/v1" })!;
const doc = { title: "取消请求", content: "内容", summary: null, tags: null };
const candidate = (id: string, content = "内容"): KnowledgeSearchCandidate => ({ ...doc, id, content, source: "manual", updatedAt: new Date(0) });

test("缺少 Key 时关闭；拒绝无效地址与阈值；模型空间与 Key 解耦", () => {
  assert.equal(readEmbeddingConfig({}), null);
  for (const url of ["http://example.test", "https://a:b@example.test", "https://example.test/?key=secret"]) {
    assert.throws(() => readEmbeddingConfig({ EMBEDDING_API_KEY: "x", EMBEDDING_BASE_URL: url }));
  }
  assert.throws(() => readEmbeddingConfig({ EMBEDDING_API_KEY: "x", EMBEDDING_BASE_URL: config.baseUrl, EMBEDDING_MIN_SIMILARITY: "NaN" }));
  assert.equal(config.modelKey, readEmbeddingConfig({ EMBEDDING_API_KEY: "rotated", EMBEDDING_BASE_URL: config.baseUrl })!.modelKey);
  assert.notEqual(config.modelKey, readEmbeddingConfig({ EMBEDDING_API_KEY: "x", EMBEDDING_BASE_URL: config.baseUrl, EMBEDDING_MODEL: "other" })!.modelKey);
});

test("分块覆盖尾部并重叠，Unicode 不被切断，内容变化改变指纹", () => {
  const content = "甲".repeat(950) + "😀".repeat(150) + "乙".repeat(1000);
  const chunks = createEmbeddingChunks({ ...doc, content });
  assert.equal(chunks.length, 3);
  assert.equal(Array.from(chunks[0].content).slice(-150).join(""), Array.from(chunks[1].content).slice(0, 150).join(""));
  const restored = chunks[0].content + chunks.slice(1).map((chunk) => Array.from(chunk.content).slice(150).join("")).join("");
  assert.equal(restored, content);
  assert.ok(chunks[0].input.includes(doc.title));
  assert.notEqual(embeddingDocumentHash(doc), embeddingDocumentHash({ ...doc, tags: "新标签" }));
  assert.deepEqual(createEmbeddingChunks({ ...doc, content: " " }), []);
});

test("校验响应乱序、重复索引、缺项、维度和零向量", () => {
  assert.deepEqual(parseEmbeddingResponse({ data: [{ index: 1, embedding: vector(1) }, { index: 0, embedding: vector() }] }, 2), [vector(), vector(1)]);
  for (const data of [[], [{ index: 1, embedding: vector() }], [{ index: 0, embedding: [1, 2] }], [{ index: 0, embedding: vector(-1) }], [{ index: 0, embedding: vector() }, { index: 0, embedding: vector() }]]) {
    assert.throws(() => parseEmbeddingResponse({ data }, 1));
  }
});

test("兼容接口使用服务端鉴权和取消信号，错误不回显供应商正文", async () => {
  const controller = new AbortController();
  let calls = 0;
  const fetcher: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://example.test/v1/embeddings");
    assert.equal(new Headers(options?.headers).get("authorization"), "Bearer test-secret");
    assert.equal(options?.signal, controller.signal);
    assert.equal(JSON.parse(String(options?.body)).dimensions, 1024);
    return Response.json({ data: [{ index: 0, embedding: vector() }] });
  };
  assert.equal((await requestEmbeddings(config, ["问题"], controller.signal, fetcher)).length, 1);
  controller.abort();
  await assert.rejects(requestEmbeddings(config, ["问题"], controller.signal, fetcher));
  assert.equal(calls, 1);
  await assert.rejects(requestEmbeddings(config, ["问题"], AbortSignal.timeout(1000), async () => new Response("secret text", { status: 429 })), /HTTP 429/);
});

test("RRF 保留纯语义命中、双路命中优先，去重且引用使用实际命中片段", () => {
  const lexical = [candidate("a"), candidate("b", "原文开头")];
  const semantic = [candidate("c", "同义改写"), candidate("b", "真正命中片段")];
  const fused = fuseKnowledgeCandidates(lexical, semantic);
  assert.equal(fused[0].id, "b");
  assert.equal(fused[0].content, "真正命中片段");
  assert.equal(fused.length, 3);
  const results = formatKnowledgeCandidates(fused, ["并不存在的关键词"]);
  assert.ok(results.some((result) => result.id === "c"));
  assert.deepEqual(results.map((result) => result.citation), ["[知识库 1]", "[知识库 2]", "[知识库 3]"]);
  assert.ok(results.reduce((sum, result) => sum + result.title.length + result.excerpt.length + result.tags.join(",").length, 0) <= MAX_KNOWLEDGE_CONTEXT_CHARACTERS);
  assert.deepEqual(fuseKnowledgeCandidates(lexical, []), lexical);
});
