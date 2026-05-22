"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { ScheduleListSkeleton } from "@/components/admin/list-skeleton";
import { api, ApiError } from "@/lib/api";
import type { ScheduleDTO } from "@cal/shared";

export function AvailabilityClient() {
  const [schedules, setSchedules] = useState<ScheduleDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.schedules.list();
        if (cancelled) return;
        setSchedules(list);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load schedules");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div>
        <PageHeader title="Availability" />
        <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          {error}. Is the API running?
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

      {schedules === null ? (
        <ScheduleListSkeleton />
      ) : schedules.length === 0 ? (
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
