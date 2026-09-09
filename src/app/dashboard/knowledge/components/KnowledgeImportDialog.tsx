"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

interface KnowledgeImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  fileCount: number;
  chunkCount: number;
  characterCount: number;
}

export function KnowledgeImportDialog({
  open,
  onClose,
  onSuccess,
}: KnowledgeImportDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/knowledge/import", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String(payload.error)
            : "文件导入失败";
        throw new Error(message);
      }

      const imported = payload as ImportResult;
      setResult(imported);
      formRef.current?.reset();
      onSuccess();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "文件导入失败");
    } finally {
      setIsPending(false);
    }
  }

  function closeDialog() {
    if (isPending) return;
    setError(null);
    setResult(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <FileUp className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">导入文件知识</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              服务端提取文字并分块保存，聊天中的 Agent 可以直接检索并引用。
            </p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">文件</label>
            <Input
              name="files"
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              multiple
              required
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              支持 PDF、TXT、MD；每次最多 3 个，单个不超过 2 MB。扫描版 PDF 暂不支持 OCR。
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">补充标签（可选）</label>
            <Input
              name="tags"
              maxLength={300}
              placeholder="例如：项目文档, 面试"
              disabled={isPending}
            />
          </div>

          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          {result && (
            <p role="status" className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
              已导入 {result.fileCount} 个文件，生成 {result.chunkCount} 个知识分块，共 {result.characterCount.toLocaleString("zh-CN")} 个字符。
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeDialog} disabled={isPending}>
              {result ? "完成" : "取消"}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "解析并导入中..." : "开始导入"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
