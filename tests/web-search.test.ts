import assert from "node:assert/strict";
import test from "node:test";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import {
  MAX_WEB_SOURCES,
  buildWebSourcesMarkdown,
  extractWebSearchTurn,
  getWebSearchPolicy,
  registerWebSearchSources,
} from "../src/lib/web-search.ts";

test("联网模式会映射为自动、强制和禁用策略", () => {
  assert.deepEqual(getWebSearchPolicy("auto", false), {
    enabled: true,
    force: false,
    toolChoice: { type: "auto" },
  });
  assert.deepEqual(getWebSearchPolicy("always", false), {
    enabled: true,
    force: true,
    toolChoice: { type: "tool", name: "web_search" },
  });
  assert.equal(getWebSearchPolicy("never", false).enabled, false);
  assert.equal(getWebSearchPolicy("never", true, true).enabled, false);
  assert.equal(getWebSearchPolicy("always", true).enabled, false);
  assert.deepEqual(getWebSearchPolicy("always", true, true), {
    enabled: true,
    force: false,
    toolChoice: { type: "auto" },
  });
});

test("网页结果只保留安全 URL、去重并限制来源数量", () => {
  const results = Array.from({ length: MAX_WEB_SOURCES + 3 }, (_, index) => ({
    type: "web_search_result" as const,
    encrypted_content: `encrypted-${index}`,
    title: `来源 ${index}`,
    url: `https://example.com/page-${index}`,
    page_age: "2026-08-26",
  }));
  results.splice(1, 0, { ...results[0]!, title: "重复来源" });
  results.splice(2, 0, {
    ...results[0]!,
    title: "危险来源",
    url: "javascript:alert(1)",
  });

  const content: ContentBlockParam[] = [
    {
      type: "server_tool_use",
      id: "web-1",
      name: "web_search",
      input: { query: "今天的新闻" },
    },
    {
      type: "web_search_tool_result",
      tool_use_id: "web-1",
      content: results,
    },
  ];

  const output = extractWebSearchTurn(content);
  assert.equal(output.executions[0]?.status, "success");
  assert.equal(output.executions[0]?.arguments.query, "今天的新闻");
  assert.equal(output.sources.length, MAX_WEB_SOURCES);
  assert.ok(output.sources.every((source) => source.url.startsWith("https://")));
  assert.equal(new Set(output.sources.map((source) => source.url)).size, MAX_WEB_SOURCES);
});

test("搜索错误会转换为可公开展示的中文信息", () => {
  const output = extractWebSearchTurn([
    {
      type: "server_tool_use",
      id: "web-error",
      name: "web_search",
      input: { query: "实时信息" },
    },
    {
      type: "web_search_tool_result",
      tool_use_id: "web-error",
      content: {
        type: "web_search_tool_result_error",
        error_code: "too_many_requests",
      },
    },
  ]);

  assert.equal(output.executions[0]?.status, "error");
  assert.equal(output.executions[0]?.error, "联网搜索请求过于频繁");
});

test("网页引用跨轮次复用编号并安全生成 Markdown", () => {
  const registry = new Map();
  const source = {
    title: "官方 [文档](伪造)",
    url: "https://example.com/docs_(new)",
    pageAge: "2026-08-26",
  };
  const first = registerWebSearchSources(registry, [source]);
  const second = registerWebSearchSources(registry, [source]);
  const markdown = buildWebSourcesMarkdown(first);

  assert.equal(first[0]?.citation, "[网页 1]");
  assert.equal(second[0]?.citation, "[网页 1]");
  assert.ok(markdown.includes("**网页来源**"));
  assert.ok(markdown.includes("官方 \\[文档\\]\\(伪造\\)"));
  assert.ok(markdown.includes("docs_%28new%29"));
});
