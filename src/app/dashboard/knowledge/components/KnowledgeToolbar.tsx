"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { KnowledgeForm } from "./KnowledgeForm";
import { KNOWLEDGE_SOURCES } from "../constants";

export function KnowledgeToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState(searchParams.get("query") ?? "");

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ query: query || undefined });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearchSubmit}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标题或内容..." className="w-56" />
        </form>

        <select
          defaultValue={searchParams.get("source") ?? ""}
          onChange={(e) => updateParams({ source: e.target.value || undefined })}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">全部来源</option>
          {KNOWLEDGE_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <Button onClick={() => setCreateOpen(true)} disabled={isPending}>新建知识条目</Button>

      <KnowledgeForm mode="create" open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => router.refresh()} />
    </div>
  );
}