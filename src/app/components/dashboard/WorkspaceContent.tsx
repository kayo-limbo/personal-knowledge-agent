"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function WorkspaceContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <main className={`min-h-0 flex-1 p-2 ${pathname === "/dashboard" ? "overflow-hidden" : "overflow-y-auto"}`}>
    <div key={pathname} className="workspace-page h-full min-h-0">{children}</div>
  </main>;
}
