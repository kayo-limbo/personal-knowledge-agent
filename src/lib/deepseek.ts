import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * DeepSeek 同时兼容 OpenAI 和 Anthropic 两套接口。
 * 本项目沿用 Anthropic SDK，是因为原有聊天流已经基于 messages.stream 实现，
 * 只替换 baseURL 就能迁移，浏览器端 SSE 和数据库代码都不需要跟着重写。
 */
const DEEPSEEK_ANTHROPIC_BASE_URL = "https://api.deepseek.com/anthropic";

/**
 * Flash 成本低、速度快，适合作为个人知识库 MVP 的默认模型。
 * 生产环境仍建议通过环境变量固定模型名，方便升级和回滚。
 */
export const DEEPSEEK_MODEL =
  process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash";

export function getDeepSeekClient(): Anthropic {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY，请先在 .env 中配置 DeepSeek API Key");
  }

  // 该模块带有 server-only 保护；Key 不能使用 NEXT_PUBLIC_ 前缀，也不能传给客户端。
  return new Anthropic({
    apiKey,
    baseURL: DEEPSEEK_ANTHROPIC_BASE_URL,
  });
}
