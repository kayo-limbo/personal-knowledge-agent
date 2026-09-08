import { redirect } from "next/navigation";
import { auth } from "@/auth";
import WorkspaceHeader from "@/app/components/dashboard/WorkspaceHeader";
import { listPrompts } from "@/lib/services/prompt.service";
import {
  createPromptAction,
  deletePromptAction,
  updatePromptAction,
} from "./actions";

interface PromptPageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

const fieldClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100";

export default async function PromptsPage({ searchParams }: PromptPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "GUEST") redirect("/dashboard");

  const [prompts, params] = await Promise.all([
    listPrompts(session.user.id),
    searchParams,
  ]);

  return (
    <main className="space-y-6">
      <WorkspaceHeader
        title="Prompt 管理"
        description="保存可复用的系统提示词；每条记录都按当前登录用户隔离。"
      />

      {params.success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {params.success}
        </p>
      )}
      {params.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {params.error}
        </p>
      )}

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">新建 Prompt</h2>
        <form action={createPromptAction} className="mt-4 space-y-4">
          <label className="block space-y-1.5 text-sm font-medium">
            <span>标题</span>
            <input className={fieldClass} name="title" maxLength={100} required placeholder="例如：知识库回答助手" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Prompt 内容</span>
            <textarea className={`${fieldClass} min-h-36 resize-y`} name="content" maxLength={8000} required placeholder="描述角色、任务、约束和输出格式" />
          </label>
          <div className="flex flex-wrap gap-5 text-sm text-gray-700">
            <label className="flex items-center gap-2"><input type="checkbox" name="favorite" /> 收藏</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isPublic" /> 标记为公开</label>
          </div>
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700" type="submit">
            保存 Prompt
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">我的 Prompt</h2>
          <span className="text-sm text-muted-foreground">共 {prompts.length} 条</span>
        </div>
        {prompts.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">
            还没有 Prompt，可先创建一条用于演示。
          </div>
        ) : (
          prompts.map((prompt) => (
            <article key={prompt.id} className="rounded-xl border bg-white p-5 shadow-sm">
              <form action={updatePromptAction} className="space-y-4">
                <input type="hidden" name="id" value={prompt.id} />
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{prompt.favorite ? "★ 已收藏" : "普通"} · {prompt.isPublic ? "公开" : "私有"}</span>
                  <time>{new Intl.DateTimeFormat("zh-CN").format(prompt.createdAt)}</time>
                </div>
                <input className={fieldClass} name="title" defaultValue={prompt.title} maxLength={100} required aria-label="Prompt 标题" />
                <textarea className={`${fieldClass} min-h-32 resize-y font-mono`} name="content" defaultValue={prompt.content} maxLength={8000} required aria-label="Prompt 内容" />
                <div className="flex flex-wrap items-center gap-5 text-sm text-gray-700">
                  <label className="flex items-center gap-2"><input type="checkbox" name="favorite" defaultChecked={prompt.favorite} /> 收藏</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="isPublic" defaultChecked={prompt.isPublic} /> 标记为公开</label>
                  <button className="ml-auto rounded-lg border px-3 py-2 font-medium hover:bg-gray-50" type="submit">保存修改</button>
                </div>
              </form>
              <details className="mt-3 border-t pt-3 text-sm">
                <summary className="cursor-pointer text-red-600">删除这条 Prompt</summary>
                <form action={deletePromptAction} className="mt-3 flex items-center gap-3">
                  <input type="hidden" name="id" value={prompt.id} />
                  <span className="text-muted-foreground">删除后不可恢复，已有会话会保留但不再关联该 Prompt。</span>
                  <button className="rounded-lg bg-red-600 px-3 py-2 font-medium text-white hover:bg-red-500" type="submit">确认删除</button>
                </form>
              </details>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
