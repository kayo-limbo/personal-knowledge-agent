"use client";

import { create } from "zustand";
import type { ChatConversation, ChatMessage } from "@/app/dashboard/chat/types";

interface ChatState {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  messagesByConversation: Record<string, ChatMessage[]>;
  isStreaming: boolean;

  setConversations: (conversations: ChatConversation[]) => void;
  upsertConversation: (conversation: ChatConversation) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  appendToMessage: (conversationId: string, messageId: string, delta: string) => void;
  finalizeMessage: (conversationId: string, messageId: string) => void;
  setStreaming: (streaming: boolean) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messagesByConversation: {},
  isStreaming: false,

  setConversations: (conversations) => set({ conversations }),

  // 新会话放到最前面；旧会话有新消息时也移动到最前面。
  upsertConversation: (conversation) =>
    set((state) => ({
      conversations: [
        conversation,
        ...state.conversations.filter((item) => item.id !== conversation.id),
      ],
    })),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: { ...state.messagesByConversation, [conversationId]: messages },
    })),

  addMessage: (conversationId, message) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [...(state.messagesByConversation[conversationId] ?? []), message],
      },
    })),

  // SSE 逐 token 追加,只更新对应消息的 content,不整条替换,避免每个 token 都重新渲染整个列表
  appendToMessage: (conversationId, messageId, delta) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((m) =>
          m.id === messageId ? { ...m, content: m.content + delta } : m
        ),
      },
    })),

  finalizeMessage: (conversationId, messageId) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((m) =>
          m.id === messageId ? { ...m, isStreaming: false } : m
        ),
      },
      isStreaming: false,
    })),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  reset: () =>
    set({ conversations: [], activeConversationId: null, messagesByConversation: {}, isStreaming: false }),
}));

// 派生 selector:当前激活会话的消息列表,组件里直接用这个 hook 就不用自己写取值逻辑
export function useActiveMessages(): ChatMessage[] {
  const activeId = useChatStore((s) => s.activeConversationId);
  const messagesByConversation = useChatStore((s) => s.messagesByConversation);
  return activeId ? messagesByConversation[activeId] ?? [] : [];
}
