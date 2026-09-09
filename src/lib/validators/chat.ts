import { z } from "zod";
import {
  DEEPSEEK_MODELS,
  DEEPSEEK_THINKING_MODES,
  DEFAULT_DEEPSEEK_MODEL,
} from "@/lib/deepseek-models";
import { WEB_SEARCH_MODES } from "@/lib/web-search-config";

export const sendChatSchema = z.object({
  conversationId: z.string().min(1).optional(),
  promptId: z.string().min(1).max(200).nullable().optional(),
  content: z.string().trim().min(1, "消息不能为空").max(12000, "单条消息不能超过 12000 个字符"),
  // 浏览器传来的模型名不能直接交给上游 API，必须经过固定白名单校验。
  model: z.enum(DEEPSEEK_MODELS).default(DEFAULT_DEEPSEEK_MODEL),
  thinkingMode: z.enum(DEEPSEEK_THINKING_MODES).default("disabled"),
  webSearchMode: z.enum(WEB_SEARCH_MODES).default("auto"),
});
