"use client";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { PersonalAvatar, usePersonalization } from "./Personalization";
export default function UserDropdown({ user }: { user: { role?: string } }) {
  const { profile, open } = usePersonalization();
  return <div className="flex items-center gap-3"><button onClick={() => open()} aria-label="打开个人资料与外观设置" className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted"><PersonalAvatar /><span className="max-w-32 truncate text-sm font-medium">{profile.name}<span className="block text-left text-xs text-muted-foreground">{user.role === "ADMIN" ? "管理员" : user.role === "GUEST" ? "访客" : "个人空间"}</span></span></button><button onClick={() => signOut()} aria-label="退出登录" title="退出登录" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><LogOut size={18} /></button></div>;
}
