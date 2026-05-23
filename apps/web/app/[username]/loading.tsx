function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function PublicProfileLoading() {
  return (
    <main className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="flex items-center gap-4">
            <Bar className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Bar className="h-5 w-40" />
              <Bar className="h-4 w-28" />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-b border-border p-5 last:border-b-0">
              <Bar className="h-4 w-48" />
              <Bar className="mt-2 h-3 w-3/4" />
              <Bar className="mt-3 h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
