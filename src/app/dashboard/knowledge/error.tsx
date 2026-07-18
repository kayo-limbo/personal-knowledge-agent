"use client";

export default function KnowledgeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <p className="text-sm text-red-500">加载知识库时出错了: {error.message}</p>
      <button onClick={reset} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">重试</button>
    </div>
  );
}