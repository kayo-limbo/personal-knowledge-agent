"use client";

import Link, { useLinkStatus } from "next/link";
import { NavItem } from "@/lib/nav-items";
import { usePathname } from "next/navigation";
import { House, Bot, BookOpen, FileText, History, Users, ChartColumn, LoaderCircle, type LucideIcon } from "lucide-react";

interface Props {
  item: NavItem;
}

const iconMap: Record<string, LucideIcon> = {
  House,
  Bot,
  BookOpen,
  FileText,
  History,
  Users,
  ChartColumn,
};

// 必须在 Link 后代中读取状态，由路由器处理完成与连续切换。
function NavigationHint({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className="absolute right-1 top-1 flex h-4 w-4 shrink-0 items-center md:static md:ml-auto" role="status" aria-live="polite">
      {pending && <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /><span className="sr-only">正在打开{label}</span></>}
    </span>
  );
}

export default function SidebarItem({ item }: Props) {
  const pathname = usePathname();
  const active = item.href === "/dashboard" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = iconMap[item.icon];
  return (
     <Link
      href={item.href}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all
      ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />

      <span className="hidden md:inline">{item.label}</span>
      <NavigationHint label={item.label} />
    </Link>
  );
}
