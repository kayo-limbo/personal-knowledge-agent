"use client";

import { Send, Square } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface ChatComposerProps {
  value: string;
  isStreaming: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

export function ChatComposer({
  value,
  isStreaming,
  error,
  onChange,
  onSubmit,
  onStop,
}: ChatComposerProps) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isStreaming && value.trim()) onSubmit();
    }
  }

  return (
    <div className="border-t bg-white/90 px-5 py-4 backdrop-blur">
      <div className="mx-auto max-w-4xl">
        {error && (
          <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex items-end gap-3 rounded-2xl border bg-white p-3 shadow-sm focus-within:ring-2 focus-within:ring-gray-300">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，Enter 发送，Shift + Enter 换行"
            rows={2}
            maxLength={12000}
            className="max-h-44 min-h-12 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none"
          />
          {isStreaming ? (
            <Button size="icon-lg" variant="outline" onClick={onStop} aria-label="停止生成">
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button size="icon-lg" onClick={onSubmit} disabled={!value.trim()} aria-label="发送消息">
              <Send />
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          DeepSeek 可能会犯错，重要信息请再次核实。
        </p>
      </div>
    </div>
  );
}
