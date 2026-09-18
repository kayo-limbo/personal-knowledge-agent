import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/lib/services/dashboard.service";
import { HomeDashboard } from "@/app/components/dashboard/HomeDashboard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const guest = session.user.role === "GUEST";
  const [dashboard, recentKnowledge] = await Promise.all([
    getDashboardData(session.user.id),
    guest ? Promise.resolve([]) : prisma.knowledgeDoc.findMany({ where: { userId: session.user.id }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, updatedAt: true } }),
  ]);
  return <HomeDashboard guest={guest} dashboard={dashboard} recentKnowledge={recentKnowledge} />;
}
