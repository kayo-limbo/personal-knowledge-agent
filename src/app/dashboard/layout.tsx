import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/app/components/dashboard/Sidebar";
import { prisma } from "@/lib/prisma";
import { readPreferences } from "@/lib/personalization";
import { PersonalizationProvider } from "@/app/components/dashboard/Personalization";
import Header from "@/app/components/dashboard/Header";
import { WorkspaceContent } from "@/app/components/dashboard/WorkspaceContent";


// Inline nav items to workaround Turbopack RSC compilation issue
type UserRole = "ADMIN" | "USER" | "GUEST";
type LucideIconName = "House" | "Bot" | "BookOpen" | "FileText" | "History" | "Users" | "ChartColumn";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIconName;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { label: "主页", href: "/dashboard", icon: "House", roles: ["ADMIN", "USER", "GUEST"] },
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

  const account = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { name: true, preferences: true } });
  const role = session.user.role;
  const filteredNavItems = navItems.filter((item) => item.roles.includes(role as never));

  return (
    <PersonalizationProvider key={session.user.id} initial={{ name: account.name || "用户", preferences: readPreferences(account.preferences) }} email={session.user.email || ""}>
    <script dangerouslySetInnerHTML={{ __html: `(function(){var t=${JSON.stringify(readPreferences(account.preferences).theme)};var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'})()` }} />
    <div className="flex h-dvh overflow-hidden bg-muted/40">
      <Sidebar items={filteredNavItems} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header user={session.user} />
        <WorkspaceContent>{children}</WorkspaceContent>
      </div>
    </div>
    </PersonalizationProvider>
  );
}
