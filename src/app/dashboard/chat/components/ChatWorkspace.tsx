"use client";

import { useEffect, useRef, useState } from "react";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";
import { useActiveMessages, useChatStore } from "@/app/store/chat-store";
import type { ChatBootstrap, ChatStreamEvent } from "../types";
import type { DeepSeekModel, DeepSeekThinkingMode } from "@/lib/deepseek-models";

interface ChatWorkspaceProps {
  bootstrap: ChatBootstrap;
  initialModel: DeepSeekModel;
}

async function readError(response: Response): Promise<string> {
  const fallback = `请求失败（HTTP ${response.status}）`;
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * fetch 也能读取 SSE。因为这里需要 POST 消息，不能使用只支持 GET 的 EventSource。
 * buffer 用来保存“半个事件”，直到收到两个换行符才解析一帧。
 */
async function consumeSse(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void
) {
  if (!response.body) throw new Error("浏览器没有收到流式响应");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) onEvent(JSON.parse(data) as ChatStreamEvent);
      boundary = buffer.indexOf("\n\n");
    }
  }
}

export function ChatWorkspace({ bootstrap, initialModel }: ChatWorkspaceProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<DeepSeekModel>(initialModel);
  const [thinkingMode, setThinkingMode] = useState<DeepSeekThinkingMode>("disabled");
  const abortRef = useRef<AbortController | null>(null);

  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const messages = useActiveMessages();
  const setConversations = useChatStore((state) => state.setConversations);
  const upsertConversation = useChatStore((state) => state.upsertConversation);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const setMessages = useChatStore((state) => state.setMessages);
  const addMessage = useChatStore((state) => state.addMessage);
  const appendToMessage = useChatStore((state) => state.appendToMessage);
  const finalizeMessage = useChatStore((state) => state.finalizeMessage);
  const setStreaming = useChatStore((state) => state.setStreaming);
  const reset = useChatStore((state) => state.reset);

  useEffect(() => {
    // Zustand 是全局状态；进入页面时用服务器数据重新初始化，避免残留上一次登录用户的数据。
    reset();
    setConversations(bootstrap.conversations);
    Object.entries(bootstrap.messagesByConversation).forEach(([id, list]) => {
      setMessages(id, list);
    });
    setActiveConversation(bootstrap.conversations[0]?.id ?? null);
  }, [bootstrap, reset, setActiveConversation, setConversations, setMessages]);

  function startNewConversation() {
    setError(null);
    setActiveConversation(null);
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || isStreaming) return;

    const previousConversationId = activeConversationId;
    const controller = new AbortController();
    abortRef.current = controller;
    setInput("");
    setError(null);
    setStreaming(true);

    let conversationId = previousConversationId;
    let assistantMessageId: string | null = null;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: previousConversationId ?? undefined,
          content,
          model,
          thinkingMode,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(await readError(response));

      conversationId = response.headers.get("X-Conversation-Id");
      const userMessageId = response.headers.get("X-User-Message-Id");
      assistantMessageId = response.headers.get("X-Assistant-Message-Id");
      const encodedTitle = response.headers.get("X-Conversation-Title");
      if (!conversationId || !userMessageId || !assistantMessageId) {
        throw new Error("服务端返回的会话信息不完整");
      }

      const now = new Date().toISOString();
      const existing = conversations.find((item) => item.id === conversationId);
      upsertConversation({
        id: conversationId,
        title: encodedTitle ? decodeURIComponent(encodedTitle) : existing?.title ?? "新对话",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      setActiveConversation(conversationId);
      addMessage(conversationId, {
        id: userMessageId,
        role: "user",
        content,
        createdAt: now,
      });
      addMessage(conversationId, {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: now,
        isStreaming: true,
      });

      await consumeSse(response, (event) => {
        if (event.type === "delta") {
          appendToMessage(conversationId!, assistantMessageId!, event.text);
        } else if (event.type === "error") {
          setError(event.message);
          appendToMessage(conversationId!, assistantMessageId!, `> ⚠️ ${event.message}`);
        }
      });
    } catch (caught: unknown) {
      const stopped = caught instanceof DOMException && caught.name === "AbortError";
      const message = stopped
        ? "已停止生成"
        : caught instanceof Error
          ? caught.message
          : "发送消息失败";
      setError(message);
      if (!stopped) setInput(content);
      if (conversationId && assistantMessageId) {
        appendToMessage(conversationId, assistantMessageId, `> ⚠️ ${message}`);
      }
    } finally {
      if (conversationId && assistantMessageId) {
        finalizeMessage(conversationId, assistantMessageId);
      } else {
        setStreaming(false);
      }
      abortRef.current = null;
    }
  }

  function stopGenerating() {
    abortRef.current?.abort();
  }

  return (
    <section className="flex h-[calc(100vh-5.5rem)] min-h-[560px] overflow-hidden rounded-xl border bg-gray-50 shadow-sm">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        disabled={isStreaming}
        onSelect={setActiveConversation}
        onNew={startNewConversation}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChatMessages messages={messages} model={model} thinkingMode={thinkingMode} />
        </div>
        <ChatComposer
          value={input}
          isStreaming={isStreaming}
          error={error}
          model={model}
          thinkingMode={thinkingMode}
          onChange={setInput}
          onModelChange={setModel}
          onThinkingModeChange={setThinkingMode}
          onSubmit={sendMessage}
          onStop={stopGenerating}
        />
      </div>
    </section>
  );
}
