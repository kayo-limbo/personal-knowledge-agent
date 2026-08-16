import type { DeepSeekModel, DeepSeekThinkingMode } from "@/lib/deepseek-models";

export type MessageRole = "user" | "assistant" | "system";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status?: "running" | "success" | "error";
  result?: unknown;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  createdAt: string;
  isStreaming?: boolean;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/** Server Component 首次打开聊天页时传给浏览器的数据。 */
export interface ChatBootstrap {
  conversations: ChatConversation[];
  messagesByConversation: Record<string, ChatMessage[]>;
}

/** 浏览器提交给 /api/chat 的最小数据；用户身份永远从服务端 Session 获取。 */
export interface SendChatInput {
  conversationId?: string;
  content: string;
  model: DeepSeekModel;
  thinkingMode: DeepSeekThinkingMode;
}

/** SSE 每一帧都是可判别联合类型，客户端可以安全地区分文本、完成和错误事件。 */
export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool"; toolCall: ToolCall }
  | { type: "done" }
  | { type: "error"; message: string };
