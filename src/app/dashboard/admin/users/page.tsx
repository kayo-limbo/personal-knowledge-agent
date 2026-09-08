import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import WorkspaceHeader from "@/app/components/dashboard/WorkspaceHeader";
import { listUsers } from "@/lib/services/user.service";
import { updateUserRoleAction } from "./actions";

interface UsersPageProps {
  searchParams: Promise<{ query?: string; success?: string; error?: string }>;
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const users = await listUsers(params.query);

  return (
    <main className="space-y-6">
      <WorkspaceHeader title="用户管理" description="查看账号及数据规模，并由管理员调整角色；密码哈希不会返回页面。" />
      {params.success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{params.success}</p>}
      {params.error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{params.error}</p>}

      <form className="flex gap-2 rounded-xl border bg-white p-4 shadow-sm" method="get">
        <input className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" name="query" defaultValue={params.query} placeholder="搜索邮箱或姓名" />
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white" type="submit">搜索</button>
        {params.query && <Link className="rounded-lg border px-4 py-2 text-sm font-medium" href="/dashboard/admin/users">清除</Link>}
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-3">用户</th><th className="px-4 py-3">数据</th><th className="px-4 py-3">注册时间</th><th className="px-4 py-3">角色</th></tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-4"><p className="font-medium">{user.name || "未设置姓名"}{user.id === session.user.id && "（当前账号）"}</p><p className="text-muted-foreground">{user.email}</p></td>
                <td className="px-4 py-4 text-muted-foreground">知识 {user._count.knowledgeDocs} · Prompt {user._count.prompts} · 会话 {user._count.conversations}</td>
                <td className="px-4 py-4 text-muted-foreground">{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(user.createdAt)}</td>
                <td className="px-4 py-4">
                  <form action={updateUserRoleAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={user.id} />
                    <select className="rounded-lg border border-gray-200 bg-white px-3 py-2" name="role" defaultValue={user.role} disabled={user.id === session.user.id}>
                      <option value="ADMIN">ADMIN</option><option value="USER">USER</option><option value="GUEST">GUEST</option>
                    </select>
                    <button className="rounded-lg border px-3 py-2 font-medium hover:bg-gray-50 disabled:opacity-50" type="submit" disabled={user.id === session.user.id}>保存</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">没有匹配的用户。</p>}
      </div>
    </main>
  );
}
