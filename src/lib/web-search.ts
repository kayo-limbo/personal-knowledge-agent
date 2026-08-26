import type {
  ContentBlockParam,
  ServerToolUseBlock,
  ToolChoice,
  WebSearchTool20250305,
} from "@anthropic-ai/sdk/resources/messages";
import type { WebSearchMode } from "@/lib/web-search-config";

export const WEB_SEARCH_TOOL_NAME = "webSearch";
export const MAX_WEB_SEARCH_USES = 1;
export const MAX_WEB_SOURCES = 5;

/** DeepSeek 在服务端执行搜索；max_uses 是第一层费用保护。 */
export const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: MAX_WEB_SEARCH_USES,
} satisfies WebSearchTool20250305;

export interface WebSearchSource {
  citation: string;
  title: string;
  url: string;
  pageAge: string | null;
}

export interface WebSearchExecution {
  id: string;
  name: typeof WEB_SEARCH_TOOL_NAME;
  arguments: Record<string, unknown>;
  status: "running" | "success" | "error";
  resultCount?: number;
  error?: string;
}

export interface WebSearchPolicy {
  enabled: boolean;
  force: boolean;
  toolChoice: ToolChoice;
}

/** 一次聊天请求全局最多联网一次；后续 Agent 轮次不再把 Web Search 暴露给模型。 */
export function getWebSearchPolicy(
  mode: WebSearchMode,
  alreadyUsed: boolean
): WebSearchPolicy {
  const enabled = mode !== "never" && !alreadyUsed;
  return {
    enabled,
    force: enabled && mode === "always",
    toolChoice:
      enabled && mode === "always"
        ? { type: "tool", name: "web_search" }
        : { type: "auto" },
  };
}

export function isWebSearchServerToolUse(
  block: ContentBlockParam | ServerToolUseBlock
): block is ServerToolUseBlock {
  return block.type === "server_tool_use" && block.name === "web_search";
}

function readArguments(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  const query = (input as Record<string, unknown>).query;
  return typeof query === "string" ? { query: query.slice(0, 500) } : {};
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function compactText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength)
    : "";
}

function publicSearchError(code: unknown): string {
  switch (code) {
    case "max_uses_exceeded":
      return "已达到本次联网搜索次数上限";
    case "too_many_requests":
      return "联网搜索请求过于频繁";
    case "query_too_long":
    case "request_too_large":
      return "联网搜索查询过长";
    case "unavailable":
      return "联网搜索暂时不可用";
    default:
      return "联网搜索执行失败";
  }
}

/**
 * DeepSeek 返回的网页内容不直接进入应用日志；这里只提取展示所需的标题、URL 和时间。
 * URL 经过协议白名单，避免把不可信搜索结果变成 javascript: 等危险链接。
 */
export function extractWebSearchTurn(content: ContentBlockParam[]): {
  executions: WebSearchExecution[];
  sources: Omit<WebSearchSource, "citation">[];
} {
  const executions = new Map<string, WebSearchExecution>();
  const sources = new Map<string, Omit<WebSearchSource, "citation">>();

  for (const block of content) {
    if (isWebSearchServerToolUse(block)) {
      executions.set(block.id, {
        id: block.id,
        name: WEB_SEARCH_TOOL_NAME,
        arguments: readArguments(block.input),
        status: "running",
      });
      continue;
    }

    if (block.type !== "web_search_tool_result") continue;

    const execution = executions.get(block.tool_use_id) ?? {
      id: block.tool_use_id,
      name: WEB_SEARCH_TOOL_NAME,
      arguments: {},
      status: "running" as const,
    };

    if (!Array.isArray(block.content)) {
      execution.status = "error";
      execution.error = publicSearchError(block.content.error_code);
      executions.set(execution.id, execution);
      continue;
    }

    for (const item of block.content) {
      if (sources.size >= MAX_WEB_SOURCES) break;
      const url = normalizeUrl(item.url);
      if (!url || sources.has(url)) continue;
      sources.set(url, {
        title: compactText(item.title, 200) || url,
        url,
        pageAge: compactText(item.page_age, 80) || null,
      });
    }

    execution.status = "success";
    execution.resultCount = block.content.length;
    executions.set(execution.id, execution);
  }

  for (const execution of executions.values()) {
    if (execution.status === "running") {
      execution.status = "error";
      execution.error = "联网搜索未返回结果";
    }
  }

  return { executions: [...executions.values()], sources: [...sources.values()] };
}

export function registerWebSearchSources(
  registry: Map<string, WebSearchSource>,
  sources: Omit<WebSearchSource, "citation">[]
): WebSearchSource[] {
  return sources.map((source) => {
    const existing = registry.get(source.url);
    if (existing) return existing;
    const registered = { ...source, citation: `[网页 ${registry.size + 1}]` };
    registry.set(source.url, registered);
    return registered;
  });
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_[\]{}()#+.!|>-])/g, "\\$1");
}

function markdownUrl(url: string): string {
  return url.replace(/\(/g, "%28").replace(/\)/g, "%29");
}

export function buildWebSourcesMarkdown(sources: WebSearchSource[]): string {
  if (sources.length === 0) return "";
  const lines = sources.map((source) => {
    const age = source.pageAge ? `（时间：${escapeMarkdownText(source.pageAge)}）` : "";
    return `- ${source.citation} [${escapeMarkdownText(source.title)}](${markdownUrl(source.url)})${age}`;
  });
  return `\n\n---\n\n**网页来源**\n\n${lines.join("\n")}`;
}
