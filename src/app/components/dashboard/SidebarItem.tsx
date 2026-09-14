"use client";

import Link, { useLinkStatus } from "next/link";
import { NavItem } from "@/lib/nav-items";
import { usePathname } from "next/navigation";
import { Bot, BookOpen, FileText, History, Users, ChartColumn, LoaderCircle, type LucideIcon } from "lucide-react";

interface Props {
  item: NavItem;
}

const iconMap: Record<string, LucideIcon> = {
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
    <span className="ml-auto flex h-4 w-4 shrink-0 items-center" role="status" aria-live="polite">
      {pending && <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /><span className="sr-only">正在打开{label}</span></>}
    </span>
  );
}

export default function SidebarItem({ item }: Props) {
  const pathname = usePathname();
  const active = pathname.startsWith(item.href);
  const Icon = iconMap[item.icon];
  return (
     <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all
      ${
        active
          ? "bg-black text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-black"
      }`}
    >
      <Icon className="h-5 w-5" />

      {item.label}
      <NavigationHint label={item.label} />
    </Link>
  );
}
