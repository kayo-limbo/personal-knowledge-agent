"use client";

import { useEffect, useRef } from "react";
import { Bot, Sparkles, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { ChatMessage } from "../types";
import {
  DEEPSEEK_MODEL_OPTIONS,
  type DeepSeekModel,
  type DeepSeekThinkingMode,
} from "@/lib/deepseek-models";

interface ChatMessagesProps {
  messages: ChatMessage[];
  model: DeepSeekModel;
  thinkingMode: DeepSeekThinkingMode;
}

export function ChatMessages({ messages, model, thinkingMode }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const modelLabel = DEEPSEEK_MODEL_OPTIONS.find((option) => option.value === model)?.label ?? model;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 rounded-2xl bg-gray-900 p-4 text-white shadow-lg">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-semibold">今天想整理或探索什么？</h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          你可以让 DeepSeek 解释概念、整理笔记或查询个人知识库；命中知识时，回答会显示引用来源。
        </p>
        <span className="mt-5 rounded-full border bg-white px-3 py-1 text-xs text-muted-foreground">
          当前选择：{modelLabel} · {thinkingMode === "enabled" ? "深度思考" : "普通模式"}
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      {messages.map((message) => {
        const fromUser = message.role === "user";
        return (
          <article key={message.id} className={`flex gap-3 ${fromUser ? "justify-end" : "justify-start"}`}>
            {!fromUser && (
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`max-w-[82%] rounded-2xl px-4 py-3 leading-7 ${
                fromUser
                  ? "bg-gray-900 text-white"
                  : "border bg-white text-gray-800 shadow-sm"
              }`}
            >
              {message.isStreaming && !message.content ? (
                <div className="flex h-7 items-center gap-1" aria-label="DeepSeek 正在输入">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:240ms]" />
                </div>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
                    pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-sm text-gray-100">{children}</pre>,
                    code: ({ children }) => <code className="rounded bg-gray-100/10 px-1 py-0.5 font-mono text-sm">{children}</code>,
                    blockquote: ({ children }) => <blockquote className="my-3 border-l-4 border-amber-400 pl-3 text-gray-500">{children}</blockquote>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
            </div>

            {fromUser && (
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-white">
                <User className="h-4 w-4" />
              </div>
            )}
          </article>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
