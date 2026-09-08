import { z } from "zod";

export const conversationTitleSchema = z
  .string()
  .trim()
  .min(1, "会话标题不能为空")
  .max(80, "会话标题不能超过 80 个字符");
