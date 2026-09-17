import { Skeleton } from "@/app/components/ui/skeleton";

export default function PageLoading({ title = "页面", chat = false }: { title?: string; chat?: boolean }) {
  return (
    <section aria-busy="true" aria-label={`${title}加载中`} className="space-y-5 p-4">
      <p role="status" className="text-sm text-muted-foreground">正在加载{title}…</p>
      <div aria-hidden="true" className="space-y-5">
        <Skeleton className="h-8 w-40 motion-reduce:animate-none" />
        <Skeleton className="h-4 w-2/3 max-w-md motion-reduce:animate-none" />
        {chat ? (
          <div className="flex min-h-80 gap-4">
            <Skeleton className="hidden w-56 shrink-0 motion-reduce:animate-none sm:block" />
            <div className="flex flex-1 flex-col justify-between gap-8 rounded-xl border bg-card p-5">
              <div className="space-y-3"><Skeleton className="h-4 w-3/4 motion-reduce:animate-none" /><Skeleton className="h-4 w-1/2 motion-reduce:animate-none" /></div>
              <Skeleton className="h-20 w-full motion-reduce:animate-none" />
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border bg-card p-5">
            <Skeleton className="h-10 w-full motion-reduce:animate-none" />
            {[0, 1, 2, 3].map(row => <Skeleton key={row} className="h-12 w-full motion-reduce:animate-none" />)}
          </div>
        )}
      </div>
    </section>
  );
}
