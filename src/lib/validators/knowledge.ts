import { z } from "zod";
import {
  KNOWLEDGE_CONTENT_MAX_LENGTH,
  KNOWLEDGE_TITLE_MAX_LENGTH,
} from "@/app/dashboard/knowledge/constants";

/**
 * 同一份校验规则同时给 Server Action 和 REST API 使用。
 * TypeScript 只在编译期工作；Zod 负责检查浏览器真正发到服务器的数据。
 */
export const knowledgeInputSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空").max(KNOWLEDGE_TITLE_MAX_LENGTH),
  content: z.string().trim().min(1, "内容不能为空").max(KNOWLEDGE_CONTENT_MAX_LENGTH),
  summary: z.string().trim().max(1000, "摘要不能超过 1000 个字符").optional(),
  tags: z.string().trim().max(500, "标签不能超过 500 个字符").optional(),
  source: z.enum(["conversation", "upload", "manual"]).optional(),
});

export const knowledgeUpdateSchema = knowledgeInputSchema.partial();

export const knowledgeSourceSchema = z.enum(["conversation", "upload", "manual"]);

/** 取得 Zod 的第一条错误，方便表单和 API 展示简洁提示。 */
export function firstValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "提交的数据格式不正确";
}
