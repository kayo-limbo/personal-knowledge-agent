import Link from "next/link";
import {
  BookOpen,
  History,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Card } from "../ui/card";

const actions = [
  {
    title: "AI 对话",
    description: "开始一个新对话吧",
    href: "/dashboard/chat",
    icon: MessageSquare,
  },
  {
        title: "知识库",
        description: "管理你的知识库",
    href: "/dashboard/knowledge",
    icon: BookOpen,
  },
  {
    title: "提示词",
    description: "整理提示词模板",
    href: "/dashboard/prompts",
    icon: Sparkles,
  },
  {
    title: "历史记录",
    description: "浏览之前的对话",
    href: "/dashboard/history",
    icon: History,
  },
];

export default function QuickActions() {
  return (
    <section className="h-52">
      <h2 className="mb-3 text-lg font-semibold">快捷入口</h2>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((item) => {
          const Icon = item.icon;

          return (
            <Link key={item.title} href={item.href}>
              <Card className="group h-full cursor-pointer p-5 transition-all hover:-translate-y-1 hover:shadow-lg">
                <Icon className="mb-4 h-8 w-8 text-primary transition group-hover:scale-110" />

                <h3 className="font-semibold">{item.title}</h3>

                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}