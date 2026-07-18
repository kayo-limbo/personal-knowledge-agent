"use client";

import { useState, useTransition } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { createKnowledgeAction, updateKnowledgeAction } from "../actions/knowledge";
import { KNOWLEDGE_SOURCES } from "../constants";
import type { KnowledgeDoc } from "@/app/dashboard/knowledge/types"

interface KnowledgeFormProps {
  mode: "create" | "edit";
  open: boolean;
  initialData?: KnowledgeDoc;
  onClose: () => void;
  onSuccess: () => void;
}

export function KnowledgeForm({ mode, open, initialData, onClose, onSuccess }: KnowledgeFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result =
      mode === "create"
        ? await createKnowledgeAction(formData)
        : initialData
        ? await updateKnowledgeAction(initialData.id, formData)
        : { success: false as const, error: "缺少编辑目标" };

    if (!result.success) {
      setError(result.error);
      return;
    }
    onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">
          {mode === "create" ? "新建知识条目" : "编辑知识条目"}
        </h2>

        <form action={(fd) => startTransition(() => handleSubmit(fd))} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">标题</label>
            <Input name="title" defaultValue={initialData?.title} required maxLength={100} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">内容</label>
            <textarea
              name="content"
              defaultValue={initialData?.content}
              required
              rows={6}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">摘要(可选)</label>
            <textarea
              name="summary"
              defaultValue={initialData?.summary ?? ""}
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">标签(逗号分隔,可选)</label>
            <Input name="tags" defaultValue={initialData?.tags ?? ""} placeholder="React, 面试, 前端" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">来源</label>
            <select
              name="source"
              defaultValue={initialData?.source ?? "manual"}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {KNOWLEDGE_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "保存中..." : "保存"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}