import WorkspaceHeader from "@/app/components/dashboard/WorkspaceHeader";
import { auth } from "@/auth";
import QuickActions from "@/app/components/dashboard/QuickAction";
import RecentConversations from "@/app/components/dashboard/RecentConversations";
import KnowledgeOverview from "@/app/components/dashboard/KnowledgeOverview";
import { getDashboardData } from "@/lib/services/dashboard.service";
  

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.id) {
        return null;
    }
    const dashboard = await getDashboardData(session.user.id);
  const userName = session?.user?.name || "User";
  return (
    <main className="space-y-4">
      <WorkspaceHeader
        title="Dashboard"
        greeting={`👋😸 欢迎回来, ${userName}!`}
        description="管理你的对话、知识库和提示词."
      />

      <QuickActions />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentConversations conversations={dashboard.recentConversations}/>

        <KnowledgeOverview stats={dashboard.stats}/>
      </div>
    </main>
  );
}