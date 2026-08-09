/** Chat 模块先定义领域类型，后续接入任意大模型时都不需要改 UI 状态结构。 */
export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  /** 仅用于前端显示打字状态，不需要存入数据库。 */
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
}

/** SSE 每一帧都是这种可判别联合类型，客户端可以安全地分别处理文本和错误。 */
export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };
