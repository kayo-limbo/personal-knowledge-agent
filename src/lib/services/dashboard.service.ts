import {prisma} from "@/lib/prisma";

export async function getRecentConversations(userId:string){
    return prisma.conversation.findMany({
        where:{
            userId,
        },
        orderBy:{
            updatedAt:"desc",
        },
        take:5,
        select:{
            id:true,
            title:true,
            updatedAt:true,
        },
    });
}

export async function getKnowledgeStats(userId:string){
    const [documents, prompts, conversations] = await Promise.all([
        prisma.knowledgeDoc.count({
            where:{ userId},
        }),
        prisma.prompt.count({
            where:{userId},
        }),
        prisma.conversation.count({
            where:{userId},
        }),
    ]);
    return {
        documents,
        prompts,
        conversations,
    };
}

export async function getDashboardData(userId: string) {
  const [recentConversations, knowledge] = await Promise.all([
    getRecentConversations(userId),
    getKnowledgeStats(userId),
  ]);
   const { documents, prompts, conversations } = knowledge;

  return {
    recentConversations,
   stats: {
        documents,
        prompts,
        conversations,
    },
  };
}