import { Calendar, Columns3, LayoutGrid } from "lucide-react";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function RescheduleFormLoading() {
  return (
    <main className="relative min-h-screen bg-background">
      <div className="absolute right-6 top-6 flex items-center gap-2">
        <button type="button" disabled className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground">
          Need help?
        </button>
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-1">
          <button type="button" disabled className="rounded-sm p-1 text-muted-foreground">
            <Calendar className="h-4 w-4" />
          </button>
          <button type="button" disabled className="rounded-sm p-1 text-muted-foreground">
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button type="button" disabled className="rounded-sm p-1 text-muted-foreground">
            <Columns3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[260px_1fr]">
          {/* Left: event info + former time */}
          <div className="border-b border-border p-6 md:border-b-0 md:border-r">
            <Bar className="h-10 w-10 rounded-full" />
            <Bar className="mt-4 h-3 w-24" />
            <Bar className="mt-2 h-6 w-40" />
            <div className="mt-6 space-y-3">
              <Bar className="h-4 w-40" />
              <Bar className="h-4 w-28" />
              <Bar className="h-4 w-32" />
              <Bar className="h-4 w-24" />
            </div>
          </div>

          {/* Form */}
          <div className="space-y-5 p-6">
            <div className="space-y-2">
              <Bar className="h-4 w-20" />
              <Bar className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Bar className="h-4 w-28" />
              <Bar className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Bar className="h-4 w-36" />
              <Bar className="h-20 w-full" />
            </div>
            <div className="flex justify-end gap-2">
              <Bar className="h-9 w-16" />
              <Bar className="h-9 w-28" />
            </div>
          </div>
        </div>
        <Bar className="mt-6 h-4 w-16" />
      </div>
    </main>
  );
}
