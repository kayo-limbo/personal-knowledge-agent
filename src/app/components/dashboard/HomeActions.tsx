"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Plus, Upload } from "lucide-react";
import { KnowledgeForm } from "@/app/dashboard/knowledge/components/KnowledgeForm";
import { KnowledgeImportDialog } from "@/app/dashboard/knowledge/components/KnowledgeImportDialog";
export function HomeActions({ guest }: { guest: boolean }) {
  const [create, setCreate] = useState(false);
  const [upload, setUpload] = useState(false);
  const router = useRouter();
  return <div className="flex flex-wrap gap-3"><Link href="/dashboard/chat?new=1" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"><MessageSquarePlus size={18} />开始对话</Link>{!guest && <><button onClick={() => setCreate(true)} className="inline-flex items-center gap-2 rounded-xl border bg-card px-5 py-3 text-sm hover:bg-muted"><Plus size={18} />新建知识</button><button onClick={() => setUpload(true)} className="inline-flex items-center gap-2 rounded-xl border bg-card px-5 py-3 text-sm hover:bg-muted"><Upload size={18} />导入文件</button><KnowledgeForm mode="create" open={create} onClose={() => setCreate(false)} onSuccess={() => router.refresh()} /><KnowledgeImportDialog open={upload} onClose={() => setUpload(false)} onSuccess={() => router.refresh()} /></>}</div>;
}
