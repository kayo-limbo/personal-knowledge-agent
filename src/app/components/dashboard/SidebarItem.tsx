"use client";

import Link from "next/link";
import { NavItem } from "@/lib/nav-items";
import { usePathname } from "next/navigation";
import { Bot, BookOpen, FileText, History, Users, ChartColumn, type LucideIcon } from "lucide-react";

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

export default function SidebarItem({ item }: Props) {
  const IconComponent = iconMap[item.icon];
  const pathname = usePathname();
  const active = pathname.startsWith(item.href);
  const Icon = iconMap[item.icon];
  return (
     <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all
      ${
        active
          ? "bg-black text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-black"
      }`}
    >
      <Icon className="h-5 w-5" />

      {item.label}
    </Link>
  );
}