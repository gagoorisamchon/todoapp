// Loading UI (PLAN 단계 8) for the list pages. Lives in the (lists) group, not app/, because a root Suspense
// boundary commits status 200 before notFound() runs on /weekly/[id] and /goals/[id] (AC13 needs 404).
export default function Loading() {
  return (
    <main role="status" aria-live="polite" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
      <span className="sr-only">불러오는 중…</span>
      <div aria-hidden className="h-7 w-40 animate-pulse rounded-md bg-muted" />
      <div aria-hidden className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <p aria-hidden className="text-center text-sm text-muted-foreground">
        불러오는 중…
      </p>
    </main>
  );
}
