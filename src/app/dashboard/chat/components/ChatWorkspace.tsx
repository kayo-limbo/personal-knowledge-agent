"use client";

import { useEffect, useRef, useState } from "react";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";
import { useActiveMessages, useChatStore } from "@/app/store/chat-store";
import type { ChatBootstrap } from "@/app/dashboard/chat/types";
import { consumeChatSse } from "@/lib/chat-stream";
import type { DeepSeekModel, DeepSeekThinkingMode } from "@/lib/deepseek-models";
import type { WebSearchMode } from "@/lib/web-search-config";

interface ChatWorkspaceProps {
  bootstrap: ChatBootstrap;
  prompts: { id: string; title: string }[];
  initialModel: DeepSeekModel;
  initialConversationId?: string;
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

export function ChatWorkspace({ bootstrap, prompts, initialModel, initialConversationId }: ChatWorkspaceProps) {
  const [input, setInput] = useState("");
  const [newPromptId, setNewPromptId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<DeepSeekModel>(initialModel);
  const [thinkingMode, setThinkingMode] = useState<DeepSeekThinkingMode>("disabled");
  const [webSearchMode, setWebSearchMode] = useState<WebSearchMode>("auto");
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
  const upsertToolCall = useChatStore((state) => state.upsertToolCall);
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
    setActiveConversation(initialConversationId ?? bootstrap.conversations[0]?.id ?? null);
    return () => {
      const controller = abortRef.current;
      abortRef.current = null;
      controller?.abort();
      setStreaming(false);
    };
  }, [bootstrap, initialConversationId, reset, setActiveConversation, setConversations, setMessages, setStreaming]);

  function startNewConversation() {
    setError(null);
    setActiveConversation(null);
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || isStreaming || abortRef.current) return;

    const previousConversationId = activeConversationId;
    const selectedPromptId = previousConversationId
      ? conversations.find(item => item.id === previousConversationId)?.promptId ?? null
      : newPromptId || null;
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
          // 续聊由服务器解析关联，避免删除模板后旧客户端提交过期 id。
          promptId: previousConversationId ? undefined : selectedPromptId,
          content,
          model,
          thinkingMode,
          webSearchMode,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(await readError(response));
      if (abortRef.current !== controller) return;

      const responseConversationId = response.headers.get("X-Conversation-Id");
      const userMessageId = response.headers.get("X-User-Message-Id");
      const responseAssistantMessageId = response.headers.get("X-Assistant-Message-Id");
      const encodedTitle = response.headers.get("X-Conversation-Title");
      if (!responseConversationId || !userMessageId || !responseAssistantMessageId) {
        throw new Error("服务端返回的会话信息不完整");
      }

      conversationId = responseConversationId;
      assistantMessageId = responseAssistantMessageId;

      const now = new Date().toISOString();
      const existing = conversations.find((item) => item.id === responseConversationId);
      upsertConversation({
        id: responseConversationId,
        promptId: response.headers.get("X-Prompt-Id") || null,
        title: encodedTitle ? decodeURIComponent(encodedTitle) : existing?.title ?? "新对话",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      setActiveConversation(responseConversationId);
      addMessage(responseConversationId, {
        id: userMessageId,
        role: "user",
        content,
        createdAt: now,
      });
      addMessage(responseConversationId, {
        id: responseAssistantMessageId,
        role: "assistant",
        content: "",
        createdAt: now,
        isStreaming: true,
      });

      await consumeChatSse(response, (event) => {
        if (abortRef.current !== controller) return;
        if (event.type === "delta") {
          appendToMessage(responseConversationId, responseAssistantMessageId, event.text);
        } else if (event.type === "tool") {
          upsertToolCall(responseConversationId, responseAssistantMessageId, event.toolCall);
        }
      });
    } catch (caught: unknown) {
      if (abortRef.current !== controller) return;
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
      if (abortRef.current === controller) {
        if (conversationId && assistantMessageId) {
          finalizeMessage(conversationId, assistantMessageId);
        } else {
          setStreaming(false);
        }
        abortRef.current = null;
      }
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
        {prompts.length > 0 && (
          <label className="flex shrink-0 items-center gap-3 border-b bg-white px-5 py-2 text-sm">
            <span>Prompt</span>
            <select aria-label="选择聊天 Prompt" className="min-w-0 flex-1 rounded-lg border px-2 py-1" disabled={isStreaming || !!activeConversationId}
              value={activeConversationId ? conversations.find(item => item.id === activeConversationId)?.promptId ?? "" : newPromptId}
              onChange={event => setNewPromptId(event.target.value)}>
              <option value="">默认知识助手</option>
              {prompts.map(prompt => <option key={prompt.id} value={prompt.id}>{prompt.title}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">新建会话可切换</span>
          </label>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChatMessages messages={messages} model={model} thinkingMode={thinkingMode} />
        </div>
        <ChatComposer
          value={input}
          isStreaming={isStreaming}
          error={error}
          model={model}
          thinkingMode={thinkingMode}
          webSearchMode={webSearchMode}
          onChange={setInput}
          onModelChange={setModel}
          onThinkingModeChange={setThinkingMode}
          onWebSearchModeChange={setWebSearchMode}
          onSubmit={sendMessage}
          onStop={stopGenerating}
        />
      </div>
    </section>
  );
}
