import { z } from "zod";

export const sendChatSchema = z.object({
  conversationId: z.string().min(1).optional(),
  content: z.string().trim().min(1, "消息不能为空").max(12000, "单条消息不能超过 12000 个字符"),
});
