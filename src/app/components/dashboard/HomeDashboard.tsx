import Link from "next/link";
import { ArrowUpRight, BookOpen, MessageSquare, FileText } from "lucide-react";
import { PersonalWelcome, SettingsButton } from "./Personalization";
import { HomeActions } from "./HomeActions";
type RecentItem = { id: string; title: string; updatedAt: Date };
export function HomeDashboard({ guest, dashboard, recentKnowledge }: {
  guest: boolean;
  dashboard: { stats: { documents: number; conversations: number; prompts: number }; recentConversations: RecentItem[] };
  recentKnowledge: RecentItem[];
}) {
  const stats = [
    { label: "知识条目", value: dashboard.stats.documents, href: "/dashboard/knowledge", icon: BookOpen },
    { label: "历史对话", value: dashboard.stats.conversations, href: "/dashboard/history", icon: MessageSquare },
    { label: "提示词模板", value: dashboard.stats.prompts, href: "/dashboard/prompts", icon: FileText },
  ];
  return <div className="home-viewport mx-auto max-w-6xl">
    <section className="home-welcome space-y-3 rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><PersonalWelcome /><SettingsButton /></div><HomeActions guest={guest} /></section>
    {!guest && <div className="home-stats grid grid-cols-3 gap-3">{stats.map(({ label, value, href, icon: Icon }) => <Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl border bg-card p-3 transition hover:border-primary/40"><span className="hidden rounded-xl bg-muted p-2 sm:block"><Icon size={21} /></span><div className="flex-1"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></div><ArrowUpRight size={17} className="text-muted-foreground group-hover:text-foreground" /></Link>)}</div>}
    <div className={`home-recent grid min-h-0 gap-3 ${guest ? "" : "md:grid-cols-2"}`}>
      <section className="home-recent-card rounded-2xl border bg-card p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold">最近对话</h2>{!guest && <Link className="text-xs text-muted-foreground hover:text-foreground" href="/dashboard/history">查看全部 →</Link>}</div>{dashboard.recentConversations.length ? <div className="min-h-0 overflow-y-auto divide-y">{dashboard.recentConversations.map(item => <Link key={item.id} href={`/dashboard/chat?conversation=${encodeURIComponent(item.id)}`} className="flex items-center gap-3 rounded-lg py-4 hover:bg-muted"><MessageSquare size={18} className="shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.updatedAt.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}</p></div><ArrowUpRight size={16} className="shrink-0 text-muted-foreground" /></Link>)}</div> : <div className="min-h-0 overflow-y-auto py-3 text-center"><MessageSquare className="mx-auto mb-3 text-muted-foreground" /><p className="text-sm">你的第一段探索，从这里开始</p><Link href="/dashboard/chat?new=1" className="mt-3 inline-block text-sm underline">开始第一次对话</Link></div>}</section>
      {!guest && <section className="home-recent-card rounded-2xl border bg-card p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold">最近更新的知识</h2><Link className="text-xs text-muted-foreground hover:text-foreground" href="/dashboard/knowledge">查看全部 →</Link></div>{recentKnowledge.length ? <div className="min-h-0 overflow-y-auto divide-y">{recentKnowledge.map(item => <Link key={item.id} href={`/dashboard/knowledge?query=${encodeURIComponent(item.title)}`} className="flex items-center gap-3 rounded-lg py-4 hover:bg-muted"><BookOpen size={18} className="shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">更新于 {item.updatedAt.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}</p></div><ArrowUpRight size={16} className="shrink-0 text-muted-foreground" /></Link>)}</div> : <div className="min-h-0 overflow-y-auto py-3 text-center"><BookOpen className="mx-auto mb-3 text-muted-foreground" /><p className="text-sm">让 AI 读懂属于你的知识</p><p className="mt-3 text-xs text-muted-foreground">点击上方“新建知识”或“导入文件”，添加第一份笔记。</p></div>}</section>}
    </div>
    <p className="home-tip px-1 text-xs leading-5 text-muted-foreground">{guest ? "欢迎探索你的 AI 工作空间。" : "试试这样开始：导入一份笔记，然后在对话中提问，让 AI 带着来源回答。"}</p>
  </div>;
}
