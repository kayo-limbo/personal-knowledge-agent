import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });


async function main() {
  const passwordHash = await bcrypt.hash("demo", 10);
  const user = await prisma.user.upsert({
    where: {
      email: "admin@example.com",
    },
    update: { passwordHash },
    create: {
      email: "admin@example.com",
      name: "Demo User",
      passwordHash,
      role: Role.ADMIN,
    },
  });


  await prisma.prompt.createMany({
    data: [
      {
        title: "React Expert",
        content: "You are a React expert.",
        userId: user.id,
      },
      {
        title: "Code Reviewer",
        content: "Review my code.",
        userId: user.id,
      },
    ],
  });


  const conversation = await prisma.conversation.create({
    data: {
      title: "Learn Next.js Architecture",
      userId: user.id,
      messages: {
        create: [
          {
            role: "user",
            content: "Explain Next.js App Router",
          },
          {
            role: "assistant",
            content: "App Router is based on React Server Components.",
          },
        ],
      },
    },
  });


  await prisma.knowledgeDoc.createMany({
    data: [
      {
        title: "React Notes",
        content: "React hooks and patterns.",
        userId: user.id,
      },
      {
        title: "Next.js Notes",
        content: "App Router documentation.",
        userId: user.id,
      },
    ],
  });


  console.log({
      user,
      conversation,
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