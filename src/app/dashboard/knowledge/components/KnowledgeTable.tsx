"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { KnowledgeForm } from "./KnowledgeForm";
import { DeleteKnowledgeDialog } from "./DeleteKnowledgeDialog";
import { getKnowledgeDetailAction } from "../actions/knowledge";
import type { KnowledgeListItem } from "../types";
import type { KnowledgeDoc } from "@/app/dashboard/knowledge/types"
interface KnowledgeTableProps {
  items: KnowledgeListItem[];
}

export function KnowledgeTable({ items }: KnowledgeTableProps) {
  const router = useRouter();
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null);
  const [deletingItem, setDeletingItem] = useState<KnowledgeListItem | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleEditClick(id: string) {
    setLoadingId(id);
    const result = await getKnowledgeDetailAction(id);
    setLoadingId(null);
    if (result.success) setEditingDoc(result.data);
  }

  function handleSuccess() {
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2">标题</th>
              <th className="px-4 py-2">标签</th>
              <th className="px-4 py-2">来源</th>
              <th className="px-4 py-2">更新时间</th>
              <th className="px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-2 font-medium">{item.title}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{item.source ?? "-"}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(item.updatedAt).toLocaleDateString("zh-CN")}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" disabled={loadingId === item.id} onClick={() => handleEditClick(item.id)}>
                      {loadingId === item.id ? "加载中..." : "编辑"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeletingItem(item)}>删除</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <KnowledgeForm
        mode="edit"
        open={!!editingDoc}
        initialData={editingDoc ?? undefined}
        onClose={() => setEditingDoc(null)}
        onSuccess={handleSuccess}
      />

      <DeleteKnowledgeDialog
        open={!!deletingItem}
        itemId={deletingItem?.id ?? null}
        itemTitle={deletingItem?.title}
        onClose={() => setDeletingItem(null)}
        onSuccess={handleSuccess}
      />
    </>
  );
}