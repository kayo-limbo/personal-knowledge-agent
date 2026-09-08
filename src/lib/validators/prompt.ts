import { z } from "zod";

export const promptInputSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空").max(100, "标题不能超过 100 个字符"),
  content: z.string().trim().min(1, "Prompt 内容不能为空").max(8000, "Prompt 内容不能超过 8000 个字符"),
  isPublic: z.boolean(),
  favorite: z.boolean(),
});

export function firstPromptValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Prompt 数据格式不正确";
}
