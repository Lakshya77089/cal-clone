import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { api } from "@/lib/api";

export default async function AvailabilityListPage() {
  let schedules: Awaited<ReturnType<typeof api.schedules.list>>;
  try {
    schedules = await api.schedules.list();
  } catch {
    return (
      <div>
        <PageHeader title="Availability" />
        <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          Couldn&rsquo;t load schedules. Is the API running?
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Availability"
        description="Configure times when you are available for bookings."
        action={
          <Button asChild>
            <Link href="/availability/new">
              <Plus className="mr-1 h-4 w-4" /> New schedule
            </Link>
          </Button>
        }
      />

      {schedules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No schedules yet.</p>
          <Button asChild className="mt-4">
            <Link href="/availability/new">Create one</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {schedules.map((s) => (
            <Link
              key={s.id}
              href={`/availability/${s.id}`}
              className="block border-b border-border px-6 py-5 transition-colors hover:bg-muted/40 last:border-0"
            >
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold">{s.name}</h3>
                {s.isDefault && (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs">Default</span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {s.timezone} · {s.rules.length} time range{s.rules.length === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
