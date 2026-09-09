import { z } from "zod";
import type { ChatStreamEvent } from "../app/dashboard/chat/types";

const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("tool"), toolCall: z.object({
    id: z.string(), name: z.string(), arguments: z.record(z.string(), z.unknown()),
    status: z.enum(["running", "success", "error"]).optional(), result: z.unknown().optional(),
  }) }),
]);

/** 网络 chunk 可以在 UTF-8 字符或 SSE 帧中间断开；只有 done 才证明回答已完成落库。 */
export async function consumeChatSse(response: Response, onEvent: (event: ChatStreamEvent) => void) {
  if (!response.body) throw new Error("浏览器没有收到流式响应");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) throw new Error("连接提前结束，回答尚未确认保存，请刷新历史记录后重试");
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 1_000_000) throw new Error("流式响应格式异常");
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith("data:"))
          .map(line => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        let event: ChatStreamEvent;
        try { event = eventSchema.parse(JSON.parse(data)); }
        catch { throw new Error("收到无法识别的流式响应，请刷新历史记录后重试"); }
        if (event.type === "error") throw new Error(event.message);
        onEvent(event);
        if (event.type === "done") return;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
