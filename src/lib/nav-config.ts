import {
  Bot,
  BookOpen,
  FileText,
  History,
  Users,
  ChartColumn,
} from "lucide-react";

export type UserRole = "ADMIN" | "USER" | "GUEST";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

export const navItems: NavItem[] = [
  {
    label: "AI 对话",
    href: "/dashboard/chat",
    icon: Bot,
    roles: ["ADMIN", "USER", "GUEST"],
  },
  {
    label: "知识库",
    href: "/dashboard/knowledge",
    icon: BookOpen,
    roles: ["ADMIN", "USER"],
  },
  {
    label: "Prompt 管理",
    href: "/dashboard/prompts",
    icon: FileText,
    roles: ["ADMIN", "USER"],
  },
  {
    label: "历史记录",
    href: "/dashboard/history",
    icon: History,
    roles: ["ADMIN", "USER"],
  },
  {
    label: "用户管理",
    href: "/dashboard/admin/users",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    label: "系统统计",
    href: "/dashboard/admin/stats",
    icon: ChartColumn,
    roles: ["ADMIN"],
  },
];