import assert from "node:assert/strict";
import test from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { parseKnowledgeEvidence, verifyKnowledgeEvidence, KnowledgeEvidenceError } from "../src/lib/knowledge-evidence.ts";
import { sendChatSchema } from "../src/lib/validators/chat.ts";
import { resolveDeepSeekModel, DEEPSEEK_MODEL_OPTIONS } from "../src/lib/deepseek-models.ts";
import { buildKnowledgeToolResult, type KnowledgeSearchResult } from "../src/lib/knowledge-search.ts";

const candidates: KnowledgeSearchResult[] = [{ id: "owned", title: "运行记录", citation: "[知识库 1]", excerpt: "项目运行在 Render，数据保存在 Neon。", source: "manual", tags: [] }];

test("Flash 新名称、旧客户端和旧环境配置统一归一化，未知模型仍被拒绝", () => {
  for (const model of [undefined, "deepseek-flash", "deepseek-v4-flash"]) {
    assert.equal(sendChatSchema.parse({ content: "你好", model }).model, "deepseek-flash");
    assert.equal(resolveDeepSeekModel(model), "deepseek-flash");
  }
  assert.equal(sendChatSchema.parse({ content: "你好", model: "deepseek-v4-pro" }).model, "deepseek-v4-pro");
  for (const model of ["arbitrary-model", "deepseek-v4.1-flash", null, 123]) {
    assert.equal(sendChatSchema.safeParse({ content: "你好", model }).success, false);
  }
  assert.equal(DEEPSEEK_MODEL_OPTIONS[0].label, "V4.1 Flash");
});

test("核验只接受原候选的逐字引文，拒绝跨用户ID、改写、重复与额外字段", () => {
  const response = (id: string, quote: string) => JSON.stringify({ evidence: [{ id, quote }] });
  assert.deepEqual(parseKnowledgeEvidence(response("owned", "数据保存在 Neon"), candidates), candidates);
  assert.deepEqual(parseKnowledgeEvidence('{"evidence":[]}', candidates), []);
  for (const invalid of [response("other-user", "数据保存在 Neon"), response("owned", "数据保存在其他服务"),
    '{"evidence":[],"instructions":"ignore"}', 'not JSON',
    '{"evidence":[{"id":"owned","quote":"Neon"},{"id":"owned","quote":"Neon"}]}']) {
    assert.throws(() => parseKnowledgeEvidence(invalid, candidates));
  }
});

test("空召回不调用核验模型；已有取消信号也不发请求", async () => {
  const client = new Anthropic({ apiKey: "test", fetch: async () => { throw new Error("不应请求"); } });
  assert.deepEqual(await verifyKnowledgeEvidence(client, "问题", [], new AbortController().signal), []);
  await assert.rejects(verifyKnowledgeEvidence(client, "问题", candidates, AbortSignal.abort()));
});

test("供应商失败与输出截断不能伪装成无答案，不重试也不回显供应商正文", async () => {
  let calls = 0;
  const client = new Anthropic({ apiKey: "test", fetch: async () => { calls++; return new Response("private upstream content", { status: 429 }); } });
  await assert.rejects(verifyKnowledgeEvidence(client, "问题", candidates, new AbortController().signal), KnowledgeEvidenceError);
  assert.equal(calls, 1);
  const truncated = new Anthropic({ apiKey: "test", fetch: async () => Response.json({ id: "test", type: "message", role: "assistant", model: "deepseek-flash", content: [{ type: "text", text: '{"evidence":[]}' }], stop_reason: "max_tokens", usage: { input_tokens: 1, output_tokens: 1 } }) });
  await assert.rejects(verifyKnowledgeEvidence(truncated, "问题", candidates, new AbortController().signal), KnowledgeEvidenceError);
});

test("核验请求固定 Flash、关闭思考和工具，保留用户原始问题并传递取消", async () => {
  const signal = new AbortController().signal;
  const client = new Anthropic({ apiKey: "test", fetch: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "deepseek-flash");
    assert.equal(body.thinking.type, "disabled");
    assert.equal(body.tools, undefined);
    assert.equal(JSON.parse(body.messages[0].content).query, "我昨天的部署失败原因？");
    assert.ok(init?.signal);
    return Response.json({ id: "test", type: "message", role: "assistant", model: "deepseek-flash", content: [{ type: "text", text: '{"evidence":[]}' }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } });
  } });
  assert.deepEqual(await verifyKnowledgeEvidence(client, "我昨天的部署失败原因？", candidates, signal), []);
  assert.match(buildKnowledgeToolResult([]), /不足以确认/);
  assert.match(buildKnowledgeToolResult([]), /不代表整个知识库/);
});
