"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";

export function KnowledgeEmbeddingStatus() {
  const [message, setMessage] = useState("正在读取语义索引状态…");
  const [busy, setBusy] = useState(true);
  const [enabled, setEnabled] = useState(false);

  async function load(rebuild = false, signal?: AbortSignal) {
    try {
      const response = await fetch("/api/knowledge/embeddings", { method: rebuild ? "POST" : "GET", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "读取语义索引失败");
      setEnabled(result.enabled);
      setMessage(result.enabled
        ? `语义索引：${result.ready}/${result.total} 条已就绪，${result.pending} 条待处理，${result.indexing} 条处理中，${result.failed} 条失败。${result.pending || result.failed ? "可点击更新继续处理；失败后请等待一分钟再重试。" : ""}`
        : result.message);
    } catch (error) {
      if (!signal?.aborted) setMessage(error instanceof Error ? error.message : "语义索引请求失败");
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    // 在网络完成回调里更新状态，避免 effect 执行期间同步触发额外渲染。
    fetch("/api/knowledge/embeddings", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "读取语义索引失败");
        setEnabled(result.enabled);
        setMessage(result.enabled
          ? `语义索引：${result.ready}/${result.total} 条已就绪，${result.pending} 条待处理，${result.indexing} 条处理中，${result.failed} 条失败。`
          : result.message);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "读取语义索引失败");
      })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, []);

  return <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
    <p className="min-w-0 flex-1 text-muted-foreground" role="status" aria-live="polite">{message}</p>
    <Button variant="outline" size="sm" disabled={busy} onClick={() => { setBusy(true); void load(); }}>刷新状态</Button>
    {enabled && <Button variant="outline" size="sm" disabled={busy} onClick={() => { setBusy(true); void load(true); }}>
      {busy ? "处理中…" : "更新语义索引"}
    </Button>}
  </div>;
}
