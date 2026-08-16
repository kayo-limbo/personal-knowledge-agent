import assert from "node:assert/strict";
import test from "node:test";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import {
  AgentRoundLimitError,
  AgentTotalTimeoutError,
  AgentToolLimitError,
  AgentToolTimeoutError,
  MAX_AGENT_ROUNDS,
  runKnowledgeAgent,
  searchKnowledgeToolInputSchema,
  type AgentModelTurn,
} from "../src/lib/knowledge-agent.ts";
import type { KnowledgeSearchResult } from "../src/lib/knowledge-search.ts";

function toolTurn(id: string, input: unknown): AgentModelTurn {
  return {
    text: "",
    stopReason: "tool_use",
    content: [
      {
        type: "tool_use",
        id,
        name: "searchKnowledge",
        input,
      },
    ],
  };
}

function finalTurn(text: string): AgentModelTurn {
  return {
    text,
    stopReason: "end_turn",
    content: [{ type: "text", text }],
  };
}

const result: KnowledgeSearchResult = {
  id: "knowledge-1",
  citation: "[知识库 1]",
  title: "部署方案",
  excerpt: "项目使用 Docker Compose 部署。",
  tags: ["部署"],
  source: "manual",
};

test("工具参数拒绝模型伪造 userId 和空查询", () => {
  assert.equal(searchKnowledgeToolInputSchema.safeParse({ query: "" }).success, false);
  assert.equal(
    searchKnowledgeToolInputSchema.safeParse({ query: "部署", userId: "other-user" }).success,
    false
  );
});

test("模型调用工具后会收到 tool_result 并继续到最终回答", async () => {
  const seenMessages: Array<Array<{ role: string; content: unknown }>> = [];
  const textDeltas: string[] = [];
  let turnIndex = 0;

  const output = await runKnowledgeAgent({
    initialMessages: [{ role: "user", content: "我的部署方案是什么？" }],
    signal: new AbortController().signal,
    requestModel: async (messages) => {
      seenMessages.push(structuredClone(messages));
      return turnIndex++ === 0
        ? toolTurn("tool-1", { query: "部署方案" })
        : finalTurn("项目使用 Docker Compose。[知识库 1]");
    },
    executeSearch: async () => [result],
    formatToolResult: (results) => JSON.stringify(results),
    onTextDelta: (delta) => textDeltas.push(delta),
  });

  assert.equal(output.rounds, 2);
  assert.equal(output.sources.length, 1);
  assert.equal(output.toolExecutions[0]?.status, "success");
  assert.equal(output.toolExecutions[0]?.resultCount, 1);
  assert.equal(textDeltas.join(""), "项目使用 Docker Compose。[知识库 1]");

  const secondTurn = seenMessages[1];
  assert.equal(secondTurn?.[1]?.role, "assistant");
  assert.equal(secondTurn?.[2]?.role, "user");
  const toolResults = secondTurn?.[2]?.content as ContentBlockParam[];
  assert.equal(toolResults[0]?.type, "tool_result");
});

test("非法工具参数会作为错误结果回填，而不是执行数据库查询", async () => {
  let searchCalls = 0;
  let turnIndex = 0;
  const output = await runKnowledgeAgent({
    initialMessages: [{ role: "user", content: "查询知识" }],
    signal: new AbortController().signal,
    requestModel: async () =>
      turnIndex++ === 0 ? toolTurn("tool-invalid", { userId: "victim" }) : finalTurn("参数不合法。"),
    executeSearch: async () => {
      searchCalls += 1;
      return [];
    },
    formatToolResult: () => "[]",
    onTextDelta: () => undefined,
  });

  assert.equal(searchCalls, 0);
  assert.equal(output.toolExecutions[0]?.status, "error");
  assert.equal(output.toolExecutions[0]?.error, "工具参数不合法");
});

test("工具执行超时会回填错误，模型仍可生成降级回答", async () => {
  let turnIndex = 0;
  const output = await runKnowledgeAgent({
    initialMessages: [{ role: "user", content: "查询知识" }],
    signal: new AbortController().signal,
    requestModel: async () =>
      turnIndex++ === 0 ? toolTurn("tool-timeout", { query: "知识" }) : finalTurn("检索暂时失败。"),
    executeSearch: () => new Promise(() => undefined),
    formatToolResult: () => "[]",
    onTextDelta: () => undefined,
    toolTimeoutMs: 5,
  });

  assert.equal(output.toolExecutions[0]?.status, "error");
  assert.equal(output.toolExecutions[0]?.error, new AgentToolTimeoutError().message);
  assert.equal(output.text, "检索暂时失败。");
});

test("多次检索命中同一知识时复用引用编号", async () => {
  const secondResult = { ...result, id: "knowledge-2", title: "补充方案" };
  const turns = [
    toolTurn("tool-1", { query: "部署" }),
    toolTurn("tool-2", { query: "部署补充" }),
    finalTurn("已整理完成。[知识库 1][知识库 2]"),
  ];
  let turnIndex = 0;
  let searchIndex = 0;

  const output = await runKnowledgeAgent({
    initialMessages: [{ role: "user", content: "整理部署方案" }],
    signal: new AbortController().signal,
    requestModel: async () => turns[turnIndex++]!,
    executeSearch: async () => (searchIndex++ === 0 ? [result] : [result, secondResult]),
    formatToolResult: (results) => JSON.stringify(results),
    onTextDelta: () => undefined,
  });

  assert.deepEqual(
    output.sources.map((source) => [source.id, source.citation]),
    [
      ["knowledge-1", "[知识库 1]"],
      ["knowledge-2", "[知识库 2]"],
    ]
  );
});

test("总超时或用户取消会保留 AbortSignal 的终止原因", async () => {
  const controller = new AbortController();
  const timeout = new AgentTotalTimeoutError();
  controller.abort(timeout);

  await assert.rejects(
    runKnowledgeAgent({
      initialMessages: [{ role: "user", content: "查询知识" }],
      signal: controller.signal,
      requestModel: async () => finalTurn("不会执行"),
      executeSearch: async () => [],
      formatToolResult: () => "[]",
      onTextDelta: () => undefined,
    }),
    timeout
  );
});

test("单轮并行工具调用超过总次数上限时不会执行工具", async () => {
  let searchCalls = 0;
  await assert.rejects(
    runKnowledgeAgent({
      initialMessages: [{ role: "user", content: "批量查询" }],
      signal: new AbortController().signal,
      requestModel: async () => ({
        text: "",
        stopReason: "tool_use",
        content: Array.from({ length: 4 }, (_, index) => ({
          type: "tool_use" as const,
          id: `parallel-${index}`,
          name: "searchKnowledge",
          input: { query: `知识 ${index}` },
        })),
      }),
      executeSearch: async () => {
        searchCalls += 1;
        return [];
      },
      formatToolResult: () => "[]",
      onTextDelta: () => undefined,
    }),
    AgentToolLimitError
  );
  assert.equal(searchCalls, 0);
});

test("超过最大轮数仍调用工具时终止循环", async () => {
  let sequence = 0;
  await assert.rejects(
    runKnowledgeAgent({
      initialMessages: [{ role: "user", content: "一直查询" }],
      signal: new AbortController().signal,
      requestModel: async () => toolTurn(`tool-${sequence++}`, { query: "知识" }),
      executeSearch: async () => [],
      formatToolResult: () => "[]",
      onTextDelta: () => undefined,
    }),
    (error: unknown) => {
      assert.ok(error instanceof AgentRoundLimitError);
      assert.ok(sequence <= MAX_AGENT_ROUNDS);
      return true;
    }
  );
});
