import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listKnowledge } from "@/lib/services/knowledge.service";
import { KnowledgeToolbar } from "./components/KnowledgeToolbar";
import { KnowledgeTable } from "./components/KnowledgeTable";
import { EmptyKnowledge } from "./components/EmptyKnowledge";
import type { KnowledgeSource } from "./types";

interface KnowledgePageProps {
  searchParams: Promise<{ query?: string; tag?: string; source?: string; page?: string }>;
}

export default async function KnowledgePage({ searchParams }: KnowledgePageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const { items, total, pageSize } = await listKnowledge({
    userId: session.user.id,
    query: params.query,
    tag: params.tag,
    source: params.source as KnowledgeSource | undefined,
    page,
  });

  return (
    <div className="space-y-4">
      <KnowledgeToolbar />
      {items.length === 0 ? (
        <EmptyKnowledge />
      ) : (
        <>
          <KnowledgeTable items={items} />
          {total > pageSize && (
            <p className="text-right text-xs text-muted-foreground">共 {total} 条,当前第 {page} 页</p>
          )}
        </>
      )}
    </div>
  );
}