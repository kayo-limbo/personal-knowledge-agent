import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { embeddingDocumentHash } from "../src/lib/embedding.ts";
import { consumeChatSse } from "../src/lib/chat-stream.ts";

const connectionString = process.env.EMBEDDING_TEST_DATABASE_URL;
const base = process.env.EMBEDDING_TEST_BASE_URL;
if (!connectionString || !base) throw new Error("需要显式配置本机测试数据库及 EMBEDDING_TEST_BASE_URL");
const databaseUrl = new URL(connectionString);
const appUrl = new URL(base);
assert.ok([databaseUrl.hostname, appUrl.hostname].every((host) => ["127.0.0.1", "localhost"].includes(host)));
assert.ok(databaseUrl.pathname.endsWith("_embedding_test"));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
const userId = `embedding-http-${randomUUID()}`;
const email = `${userId}@example.test`;
const password = randomUUID();
const cookies = new Map<string, string>();
async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
  headers.set("origin", appUrl.origin);
  const response = await fetch(new URL(path, base), { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(55_000) });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const split = pair.indexOf("=");
    cookies.set(pair.slice(0, split), pair.slice(split + 1));
  }
  return response;
}
async function waitReady(documentId: string, expectedContent: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const doc = await db.knowledgeDoc.findFirst({ where: { id: documentId, userId }, include: { embeddingIndex: { include: { chunks: { select: { content: true } } } } } });
    assert.ok(doc);
    if (doc.embeddingIndex?.status === "failed") throw new Error("后台索引失败，请检查服务端脱敏错误日志");
    if (doc.embeddingIndex?.status === "ready") {
      assert.equal(doc.embeddingIndex.sourceHash, embeddingDocumentHash(doc));
      assert.equal(doc.embeddingIndex.chunks[0].content, expectedContent);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("等待自动索引超时");
}
try {
  await db.user.create({ data: { id: userId, email, passwordHash: await bcrypt.hash(password, 10), role: "USER" } });
  const csrf = await (await request("/api/auth/csrf")).json();
  await request("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email, password, csrfToken: csrf.csrfToken, callbackUrl: `${appUrl.origin}/dashboard` }) });
  assert.equal((await (await request("/api/auth/session")).json()).user?.id, userId);
  const original = "公开测试资料：使用 AbortController 取消上游生成请求，避免页面退出后继续计算。";
  const created = await request("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "自动索引生命周期测试", content: original }) });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  await waitReady(id, original);
  console.log("PASS: create -> automatic embedding ready");
  const changed = "公开测试资料：使用 TextDecoder 的 stream 模式解码分段中文，使用缓冲区拼接 SSE 事件。";
  const updated = await request(`/api/knowledge/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: changed }) });
  assert.equal(updated.status, 200);
  await waitReady(id, changed);
  console.log("PASS: update -> new content hash and vectors ready");
  await db.knowledgeEmbeddingIndex.update({ where: { documentId: id }, data: { status: "failed", leaseUntil: new Date(0) } });
  const retried = await request("/api/knowledge/embeddings", { method: "POST" });
  assert.equal(retried.status, 200);
  assert.equal((await retried.json()).completed, 1);
  await waitReady(id, changed);
  console.log("PASS: explicit retry recovers failed index");
  if (process.argv.includes("--chat")) {
    for (const scenario of [
      { model: "deepseek-flash", thinkingMode: "disabled", content: "请检索我的知识库，告诉我怎样避免 SSE 分段中文乱码？", answerable: true },
      { model: "deepseek-v4-flash", thinkingMode: "enabled", content: "请检索我的知识库，说明应该如何拼接 SSE 消息。", answerable: true },
      { model: "deepseek-flash", thinkingMode: "disabled", content: "请检索我的知识库，上周 SSE 中断事故发生在几月几日？资料没有记载就明确说明。", answerable: false },
    ]) {
      const started = performance.now();
      const response = await request("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...scenario, webSearchMode: "never" }) });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-model"), "deepseek-flash");
      let text = "";
      let done = false;
      let successfulSearch = false;
      await consumeChatSse(response, (event) => {
        if (event.type === "delta") text += event.text;
        if (event.type === "done") done = true;
        if (event.type === "tool" && event.toolCall.name === "searchKnowledge" && event.toolCall.status === "success") successfulSearch = true;
        if (event.type === "tool") assert.notEqual(event.toolCall.status, "error");
      });
      assert.ok(done && successfulSearch);
      if (scenario.answerable) assert.match(text, /\[知识库 \d+\]/);
      else { assert.doesNotMatch(text, /\[知识库 \d+\]/); assert.match(text, /不足|没有|未记录|未记载|无法确认|未找到/); }
      const saved = await db.message.findFirst({ where: { id: response.headers.get("x-assistant-message-id")!, role: "assistant", conversation: { userId } } });
      assert.equal(saved?.content, text);
      console.log(JSON.stringify({ pass: true, model: scenario.model, thinkingMode: scenario.thinkingMode, answerable: scenario.answerable,
        milliseconds: Math.round(performance.now() - started), response: text }));
    }
  }
  assert.equal((await request(`/api/knowledge/${id}`, { method: "DELETE" })).status, 204);
  assert.equal(await db.knowledgeEmbeddingIndex.count({ where: { documentId: id } }), 0);
  console.log("PASS: delete cascades index and chunks");
} finally {
  await db.message.deleteMany({ where: { conversation: { userId } } });
  await db.conversation.deleteMany({ where: { userId } });
  await db.chatQuota.deleteMany({ where: { subjectId: userId, scope: "user" } });
  await db.knowledgeDoc.deleteMany({ where: { userId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
}
