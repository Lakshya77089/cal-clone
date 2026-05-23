import { ChevronLeft, Flag } from "lucide-react";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function BookingConfirmationLoading() {
  return (
    <main className="relative min-h-screen bg-background">
      <span className="absolute left-6 top-6 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to bookings
      </span>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-8 py-10 text-center">
            <Bar className="mx-auto mb-5 h-14 w-14 rounded-full" />
            <Bar className="mx-auto h-7 w-72" />
            <Bar className="mx-auto mt-3 h-4 w-96" />
          </div>

          <div className="px-8 py-6">
            <div className="grid grid-cols-[160px_1fr] gap-y-5 text-sm">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="contents">
                  <Bar className="h-4 w-24" />
                  <div className="space-y-2">
                    <Bar className="h-4 w-3/4" />
                    <Bar className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 border-t border-border px-8 py-5">
            <Bar className="h-4 w-28" />
            <div className="flex items-center gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Bar key={i} className="h-9 w-9" />
              ))}
            </div>
          </div>
        </div>

        <Bar className="mt-6 h-4 w-72" />
        <span className="mt-12 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Flag className="h-3.5 w-3.5" /> Report booking
        </span>
      </div>
    </main>
  );
}
