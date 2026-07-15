import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/app/components/dashboard/Sidebar";
import Header from "@/app/components/dashboard/Header";


// Inline nav items to workaround Turbopack RSC compilation issue
type UserRole = "ADMIN" | "USER" | "GUEST";
type LucideIconName = "Bot" | "BookOpen" | "FileText" | "History" | "Users" | "ChartColumn";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIconName;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { label: "AI 对话", href: "/dashboard/chat", icon: "Bot", roles: ["ADMIN", "USER", "GUEST"] },
  { label: "知识库", href: "/dashboard/knowledge", icon: "BookOpen", roles: ["ADMIN", "USER"] },
  { label: "Prompt 管理", href: "/dashboard/prompts", icon: "FileText", roles: ["ADMIN", "USER"] },
  { label: "历史记录", href: "/dashboard/history", icon: "History", roles: ["ADMIN", "USER"] },
  { label: "用户管理", href: "/dashboard/admin/users", icon: "Users", roles: ["ADMIN"] },
  { label: "系统统计", href: "/dashboard/admin/stats", icon: "ChartColumn", roles: ["ADMIN"] },
];

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;
  const filteredNavItems = navItems.filter((item) => item.roles.includes(role as never));

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar items={filteredNavItems} />
      <div className="flex flex-1 flex-col">
        <Header user={session.user} />
        <main className="flex-1 p-2">{children}</main>
      </div>
    </div>
  );
}