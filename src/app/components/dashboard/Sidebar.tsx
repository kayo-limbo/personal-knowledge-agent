"use client";
import SidebarItem from "./SidebarItem";
import { NavItem } from "@/lib/nav-items";

interface Props {
  items: NavItem[];
}

export default function Sidebar({ items }: Props) {
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-200 bg-white">
      <div className="border-b px-6 py-6">
        <h1 className="text-xl font-bold">
          Knowledge Agent
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          AI Workspace
        </p>
      </div>

      <nav className="flex-1 space-y-2 p-4">
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