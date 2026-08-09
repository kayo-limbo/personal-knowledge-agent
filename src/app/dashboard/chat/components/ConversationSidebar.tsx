"use client";

import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { ChatConversation } from "../types";

interface ConversationSidebarProps {
  conversations: ChatConversation[];
  activeId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  disabled,
  onSelect,
  onNew,
}: ConversationSidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-white/70">
      <div className="border-b p-4">
        <Button className="h-10 w-full" onClick={onNew} disabled={disabled}>
          <MessageSquarePlus />
          新对话
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          最近对话
        </p>
        {conversations.length === 0 ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">还没有历史对话</p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(conversation.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  activeId === conversation.id
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="block truncate font-medium">{conversation.title}</span>
                <span className={`mt-1 block text-xs ${activeId === conversation.id ? "text-gray-300" : "text-gray-400"}`}>
                  {new Date(conversation.updatedAt).toLocaleDateString("zh-CN")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
