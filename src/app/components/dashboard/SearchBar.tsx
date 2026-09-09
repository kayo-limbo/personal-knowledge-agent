"use client";

import { Search } from "lucide-react";
import { Input } from "../ui/input";
import { useState } from "react";

export default function SearchBar() {
  const [target, setTarget] = useState("/dashboard/knowledge");
  return (
    <form action={target} method="get" role="search" className="flex items-center gap-2">
      <select aria-label="搜索范围" value={target} onChange={event => setTarget(event.target.value)} className="rounded-lg border bg-white px-2 py-1 text-sm">
        <option value="/dashboard/knowledge">知识库</option>
        <option value="/dashboard/history">对话标题</option>
      </select>
      <div className="relative w-full max-w-sm">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        size={18}
      />

      <Input
        name="query"
        aria-label="搜索关键词"
        placeholder="输入关键词，回车搜索"
        maxLength={100}
        required
        className="pl-10"
      />
      </div>
      <button type="submit" className="shrink-0 rounded-lg border px-2 py-1 text-sm">搜索</button>
    </form>
  );
}
