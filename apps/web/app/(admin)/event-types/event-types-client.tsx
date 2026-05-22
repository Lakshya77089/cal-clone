"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { EventTypeCard } from "@/components/admin/event-type-card";
import { api, ApiError } from "@/lib/api";
import type { EventTypeDTO } from "@cal/shared";

export function EventTypesClient() {
  const [eventTypes, setEventTypes] = useState<EventTypeDTO[] | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <PageHeader
        title="Event Types"
        description="Create events to share for people to book on your calendar."
        action={
          <Button asChild>
            <Link href="/event-types/new">
              <Plus className="mr-1 h-4 w-4" /> New
            </Link>
          </Button>
        }
      />

      {eventTypes === null ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : eventTypes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No event types yet.</p>
          <Button asChild className="mt-4">
            <Link href="/event-types/new">Create your first</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {eventTypes.map((et) => (
            <EventTypeCard key={et.id} eventType={et} username={username ?? ""} />
          ))}
        </div>
      )}
    </div>
  );
}
