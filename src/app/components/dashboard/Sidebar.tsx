"use client";
import SidebarItem from "./SidebarItem";
import { NavItem } from "@/lib/nav-items";

interface Props {
  items: NavItem[];
}

export default function Sidebar({ items }: Props) {
  return (
    <aside className="flex h-full w-16 md:w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="hidden border-b px-6 py-6 md:block">
        <h1 className="text-xl font-bold">
          Knowledge Agent
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          AI Workspace
        </p>
      </div>

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 md:p-4">
        {items.map((item) => (
          <SidebarItem
            key={item.href}
            item={item}
          />
        ))}
      </nav>
    </aside>
  );
}
