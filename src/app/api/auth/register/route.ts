import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法 JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "注册信息格式不正确" },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "该邮箱已被注册" }, { status: 409 });
    }

    // 数据库只保存单向哈希，任何时候都不保存或记录用户的明文密码。
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        name: parsed.data.name || null,
        role: "USER",
      },
      select: { id: true, email: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    // 详细异常只写入服务端日志，避免把数据库结构暴露给浏览器。
    console.error("Register user failed", error);
    return NextResponse.json({ error: "注册失败，请稍后再试" }, { status: 500 });
  }
}
