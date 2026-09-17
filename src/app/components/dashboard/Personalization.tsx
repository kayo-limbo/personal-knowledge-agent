"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Settings2, X } from "lucide-react";
import { avatars, backgrounds, defaultPreferences, type Preferences } from "@/lib/personalization";
import { saveProfile } from "@/app/dashboard/profile-actions";

type Tab = "profile" | "theme" | "background";
type Profile = { name: string; preferences: Preferences };
const Context = createContext<{ profile: Profile; open: (tab?: Tab) => void } | null>(null);
export function usePersonalization() {
  const value = useContext(Context);
  if (!value) throw new Error("PersonalizationProvider missing");
  return value;
}
export function PersonalAvatar({ className = "h-10 w-10" }: { className?: string }) {
  const { profile } = usePersonalization();
  return <span aria-label={`${profile.name}的头像`} className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl text-foreground ${className}`}>
    {profile.preferences.avatar === "initial" ? profile.name.charAt(0).toUpperCase() : avatars[profile.preferences.avatar]}
  </span>;
}
export function SettingsButton({ tab = "profile", children = "个性化设置" }: { tab?: Tab; children?: ReactNode }) {
  const { open } = usePersonalization();
  return <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm hover:bg-muted" onClick={() => open(tab)}><Settings2 size={16} />{children}</button>;
}
export function PersonalWelcome() {
  const { profile } = usePersonalization();
  return <div className="flex items-center gap-4"><PersonalAvatar className="h-16 w-16 text-3xl" /><div><p className="mb-1 text-xs font-medium tracking-widest text-muted-foreground">我的知识工作台</p><h1 className="text-2xl font-semibold tracking-tight">欢迎回来，{profile.name}</h1><p className="mt-2 text-sm text-muted-foreground">从你的知识中，找到新的答案。</p></div></div>;
}
export function ChatBackground({ children }: { children: ReactNode }) {
  const { profile } = usePersonalization();
  return <div className="chat-backdrop min-h-0 flex-1 overflow-y-auto" data-background={profile.preferences.background} style={{ "--chat-overlay": `${profile.preferences.overlay}%` } as CSSProperties}>{children}</div>;
}
export function PersonalizationProvider({ initial, email, children }: { initial: Profile; email: string; children: ReactNode }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>("profile");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const profile = editing ? draft : saved;
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      const dark = profile.preferences.theme === "dark" || (profile.preferences.theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    }
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [profile.preferences.theme]);
  function open(next: Tab = "profile") { setDraft(saved); setTab(next); setError(""); setNotice(""); setEditing(true); dialog.current?.showModal(); }
  function close() { if (busy) return; dialog.current?.close(); setEditing(false); }
  function change<K extends keyof Preferences>(key: K, value: Preferences[K]) { setDraft(previous => ({ ...previous, preferences: { ...previous.preferences, [key]: value } })); }
  async function save() {
    setBusy(true); setError("");
    try {
      const result = await saveProfile(draft);
      if (result.error) { setError(result.error); return; }
      setSaved({ ...draft, name: draft.name.trim() });
      setEditing(false); dialog.current?.close(); setNotice("个性化设置已保存");
    } catch { setError("网络连接失败，请重试"); } finally { setBusy(false); }
  }
  return <Context.Provider value={{ profile, open }}>
    {children}
    {notice && <div role="status" className="fixed right-5 bottom-5 z-50 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg">{notice}</div>}
    <dialog ref={dialog} aria-labelledby="personalization-title" onCancel={event => { event.preventDefault(); close(); }} onClose={() => setEditing(false)} className="fixed inset-0 m-auto max-h-[90dvh] w-[min(640px,calc(100%-2rem))] overflow-y-auto rounded-2xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/45">
      <div className="flex items-center justify-between border-b p-5"><div><h2 id="personalization-title" className="text-lg font-semibold">个性化设置</h2><p className="mt-1 text-xs text-muted-foreground">实时预览，保存后同步到你的账号</p></div><button aria-label="关闭设置" disabled={busy} onClick={close} className="rounded-lg p-2 hover:bg-muted"><X size={20} /></button></div>
      <div className="flex gap-2 border-b p-3" aria-label="设置分类">{([["profile", "个人资料"], ["theme", "外观主题"], ["background", "聊天背景"]] as const).map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)} className={`flex-1 rounded-lg px-2 py-2 text-sm ${tab === key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{label}</button>)}</div>
      <fieldset disabled={busy} className="space-y-5 p-5">
        {tab === "profile" && <><div className="flex items-center gap-4"><PersonalAvatar className="h-16 w-16 text-3xl" /><p className="text-sm text-muted-foreground">选择一个属于你的头像</p></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{Object.entries(avatars).map(([key, label]) => <button key={key} aria-label={`头像：${label}`} aria-pressed={draft.preferences.avatar === key} onClick={() => change("avatar", key as Preferences["avatar"])} className={`rounded-xl border p-3 ${draft.preferences.avatar === key ? "border-primary bg-primary/10" : "hover:bg-muted"}`}>{label}</button>)}</div><label className="block text-sm">昵称<input maxLength={40} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></label><label className="block text-sm">邮箱<input readOnly value={email} className="mt-2 w-full rounded-lg border bg-muted px-3 py-2 text-muted-foreground" /></label></>}
        {tab === "theme" && <><p className="text-sm text-muted-foreground">为整个工作空间选择舒适的配色。</p><div className="grid grid-cols-3 gap-3">{([["light", "浅色"], ["dark", "深色"], ["system", "跟随系统"]] as const).map(([key, label]) => <button key={key} aria-pressed={draft.preferences.theme === key} onClick={() => change("theme", key)} className={`rounded-xl border p-3 ${draft.preferences.theme === key ? "ring-2 ring-primary" : ""}`}><span className={`mb-3 flex h-20 gap-2 rounded-lg p-2 ${key === "dark" ? "bg-zinc-900" : key === "light" ? "bg-zinc-100" : "bg-gradient-to-r from-zinc-100 to-zinc-800"}`}><span className="w-1/4 rounded bg-zinc-400/40" /><span className="mt-3 h-7 flex-1 rounded bg-zinc-400/40" /></span>{label}</button>)}</div></>}
        {tab === "background" && <><p className="text-sm text-muted-foreground">应用于所有聊天，仅改变消息区域。</p><div className="grid grid-cols-3 gap-3">{Object.entries(backgrounds).map(([key, label]) => <button key={key} aria-pressed={draft.preferences.background === key} onClick={() => change("background", key as Preferences["background"])} className={`overflow-hidden rounded-xl border ${draft.preferences.background === key ? "ring-2 ring-primary" : ""}`}><span data-background={key} className="chat-backdrop block h-16" /><span className="block p-2 text-sm">{label}</span></button>)}</div><label className="block text-sm">背景柔化：{draft.preferences.overlay}%<input type="range" min="0" max="80" value={draft.preferences.overlay} onChange={event => change("overlay", Number(event.target.value))} className="mt-3 w-full" /></label><div className="chat-backdrop space-y-3 rounded-xl border p-4" data-background={draft.preferences.background} style={{ "--chat-overlay": `${draft.preferences.overlay}%` } as CSSProperties}><p className="ml-auto w-fit rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground">帮我总结这份笔记</p><div className="max-w-[85%] rounded-xl border bg-card p-3 text-sm">这份笔记主要介绍了知识检索的流程。<span className="mt-2 block text-xs text-muted-foreground">来源：学习笔记 [1]</span><pre className="mt-2 overflow-x-auto rounded bg-muted p-2">searchKnowledge(query)</pre></div></div><button className="text-sm underline" onClick={() => setDraft({ ...draft, preferences: { ...draft.preferences, background: defaultPreferences.background, overlay: defaultPreferences.overlay } })}>恢复默认背景</button></>}
      </fieldset>
      <div className="sticky bottom-0 border-t bg-card p-5">{error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-3"><button disabled={busy} onClick={close} className="rounded-lg border px-4 py-2 text-sm">取消</button><button disabled={busy || !draft.name.trim()} onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? "正在保存…" : "保存设置"}</button></div></div>
    </dialog>
  </Context.Provider>;
}
