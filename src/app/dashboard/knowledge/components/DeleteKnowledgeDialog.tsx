"use client";

import { useState, useTransition } from "react";
import { Button } from "@/app/components/ui/button";
import { deleteKnowledgeAction } from "../actions/knowledge";

interface DeleteKnowledgeDialogProps {
  open: boolean;
  itemId: string | null;
  itemTitle?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteKnowledgeDialog({ open, itemId, itemTitle, onClose, onSuccess }: DeleteKnowledgeDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open || !itemId) return null;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteKnowledgeAction(itemId!);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSuccess();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold">删除知识条目</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          确定要删除{itemTitle ? `「${itemTitle}」` : "这条知识"}吗?此操作无法撤销。
        </p>
        {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "删除中..." : "确认删除"}
          </Button>
        </div>
      </div>
    </div>
  );
}