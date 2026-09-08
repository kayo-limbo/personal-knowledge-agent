import "server-only";

import { prisma } from "@/lib/prisma";

export type ManagedUserRole = "ADMIN" | "USER" | "GUEST";

export async function listUsers(query?: string) {
  const normalizedQuery = query?.trim();
  return prisma.user.findMany({
    where: normalizedQuery
      ? {
          OR: [
            { email: { contains: normalizedQuery, mode: "insensitive" } },
            { name: { contains: normalizedQuery, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { conversations: true, prompts: true, knowledgeDocs: true } },
    },
  });
}

export async function updateUserRole(id: string, role: ManagedUserRole) {
  const result = await prisma.user.updateMany({ where: { id }, data: { role } });
  if (result.count === 0) throw new Error("用户不存在");
}
