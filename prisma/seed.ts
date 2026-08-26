import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl || !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error("运行 seed 前请配置 PostgreSQL DATABASE_URL");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5_000,
  max: 1,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("demo", 10);
  const user = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { passwordHash },
    create: {
      email: "admin@example.com",
      name: "Demo User",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  await Promise.all([
    prisma.prompt.upsert({
      where: { id: "seed-prompt-react-expert" },
      update: {},
      create: {
        id: "seed-prompt-react-expert",
        title: "React Expert",
        content: "You are a React expert.",
        userId: user.id,
      },
    }),
    prisma.prompt.upsert({
      where: { id: "seed-prompt-code-reviewer" },
      update: {},
      create: {
        id: "seed-prompt-code-reviewer",
        title: "Code Reviewer",
        content: "Review my code.",
        userId: user.id,
      },
    }),
  ]);

  const conversation = await prisma.conversation.upsert({
    where: { id: "seed-conversation-nextjs" },
    update: {},
    create: {
      id: "seed-conversation-nextjs",
      title: "Learn Next.js Architecture",
      userId: user.id,
      messages: {
        create: [
          { role: "user", content: "Explain Next.js App Router" },
          {
            role: "assistant",
            content: "App Router is based on React Server Components.",
          },
        ],
      },
    },
  });

  await Promise.all([
    prisma.knowledgeDoc.upsert({
      where: { id: "seed-knowledge-react" },
      update: {},
      create: {
        id: "seed-knowledge-react",
        title: "React Notes",
        content: "React hooks and patterns.",
        source: "manual",
        tags: "React,Frontend",
        userId: user.id,
      },
    }),
    prisma.knowledgeDoc.upsert({
      where: { id: "seed-knowledge-nextjs" },
      update: {},
      create: {
        id: "seed-knowledge-nextjs",
        title: "Next.js Notes",
        content: "App Router documentation.",
        source: "manual",
        tags: "Next.js,Frontend",
        userId: user.id,
      },
    }),
  ]);

  console.log({
    user: { id: user.id, email: user.email },
    conversation: { id: conversation.id, title: conversation.title },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
