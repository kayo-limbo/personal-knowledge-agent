"use client";

import { Send, Square } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  DEEPSEEK_MODEL_OPTIONS,
  type DeepSeekModel,
  type DeepSeekThinkingMode,
} from "@/lib/deepseek-models";

interface ChatComposerProps {
  value: string;
  isStreaming: boolean;
  error: string | null;
  model: DeepSeekModel;
  thinkingMode: DeepSeekThinkingMode;
  onChange: (value: string) => void;
  onModelChange: (model: DeepSeekModel) => void;
  onThinkingModeChange: (mode: DeepSeekThinkingMode) => void;
  onSubmit: () => void;
  onStop: () => void;
}

export function ChatComposer({
  value,
  isStreaming,
  error,
  model,
  thinkingMode,
  onChange,
  onModelChange,
  onThinkingModeChange,
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
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5">
            <span>模型</span>
            <select
              value={model}
              disabled={isStreaming}
              onChange={(event) => onModelChange(event.target.value as DeepSeekModel)}
              className="bg-transparent font-medium text-gray-800 outline-none disabled:cursor-not-allowed"
              aria-label="选择 DeepSeek 模型"
            >
              {DEEPSEEK_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} · {option.description}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5">
            <span>回答模式</span>
            <select
              value={thinkingMode}
              disabled={isStreaming}
              onChange={(event) =>
                onThinkingModeChange(event.target.value as DeepSeekThinkingMode)
              }
              className="bg-transparent font-medium text-gray-800 outline-none disabled:cursor-not-allowed"
              aria-label="选择回答模式"
            >
              <option value="disabled">普通模式 · 更快更省</option>
              <option value="enabled">深度思考 · 更慢且消耗更多</option>
            </select>
          </label>
        </div>
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
