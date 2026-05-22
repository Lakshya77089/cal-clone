function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export function EventTypeListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-6 py-5 last:border-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <Bar className="h-4 w-32" />
              <Bar className="h-3 w-40" />
            </div>
            <div className="mt-3 flex gap-2">
              <Bar className="h-4 w-12" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Bar className="h-5 w-9 rounded-full" />
            <Bar className="h-8 w-8" />
            <Bar className="h-8 w-8" />
            <Bar className="h-8 w-8" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ScheduleListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-border px-6 py-5 last:border-0">
          <div className="flex items-center gap-3">
            <Bar className="h-4 w-40" />
            <Bar className="h-4 w-14" />
          </div>
          <Bar className="mt-3 h-3 w-56" />
        </div>
      ))}
    </div>
  );
}

export function BookingListSkeleton({ groups = 2, perGroup = 2 }: { groups?: number; perGroup?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: groups }).map((_, g) => (
        <div key={g}>
          <Bar className="mb-2 h-3 w-32" />
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {Array.from({ length: perGroup }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 border-b border-border px-6 py-4 last:border-0">
                <div className="w-32 shrink-0 space-y-2">
                  <Bar className="h-4 w-20" />
                  <Bar className="h-3 w-16" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Bar className="h-4 w-48" />
                  <Bar className="h-3 w-72" />
                </div>
                <div className="flex shrink-0 gap-2">
                  <Bar className="h-8 w-24" />
                  <Bar className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
