"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/page-header";
import { EventTypeCard } from "@/components/admin/event-type-card";
import { EventTypeListSkeleton } from "@/components/admin/list-skeleton";
import { api, ApiError } from "@/lib/api";
import type { EventTypeDTO } from "@cal/shared";

export function EventTypesClient() {
  const [eventTypes, setEventTypes] = useState<EventTypeDTO[] | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, list] = await Promise.all([api.me(), api.eventTypes.list()]);
        if (cancelled) return;
        setUsername(me.username);
        setEventTypes(list);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not reach the API");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!eventTypes) return null;
    const q = query.trim().toLowerCase();
    if (!q) return eventTypes;
    return eventTypes.filter((et) => {
      return (
        et.title.toLowerCase().includes(q) ||
        et.slug.toLowerCase().includes(q) ||
        (et.description ?? "").toLowerCase().includes(q) ||
        `${et.durationMinutes}m`.includes(q)
      );
    });
  }, [eventTypes, query]);

  if (error) {
    return (
      <div>
        <PageHeader title="Event Types" description="Couldn't reach the API." />
        <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          {error}
        </div>
      </div>
    );
  }

  const totalCount = eventTypes?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Event Types"
        description="Create events to share for people to book on your calendar."
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="h-9 w-48 pl-8"
                disabled={totalCount === 0}
              />
            </div>
            <Button asChild>
              <Link href="/event-types/new">
                <Plus className="mr-1 h-4 w-4" /> New
              </Link>
            </Button>
          </div>
        }
      />

      {eventTypes === null ? (
        <EventTypeListSkeleton />
      ) : totalCount === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No event types yet.</p>
          <Button asChild className="mt-4">
            <Link href="/event-types/new">Create your first</Link>
          </Button>
        </div>
      ) : filtered && filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No results for &ldquo;{query}&rdquo;.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {filtered!.map((et) => (
            <EventTypeCard key={et.id} eventType={et} username={username ?? ""} />
          ))}
        </div>
      )}
    </div>
  );
}
