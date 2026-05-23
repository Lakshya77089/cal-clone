"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/page-header";
import { EventTypeCard } from "@/components/admin/event-type-card";
import { EventTypeListSkeleton } from "@/components/admin/list-skeleton";
import {
  useGetMeQuery,
  useListEventTypesQuery,
  useReorderEventTypesMutation,
} from "@/lib/api/calApi";
import type { EventTypeDTO } from "@cal/shared";

export function EventTypesClient() {
  const { data: me } = useGetMeQuery();
  const { data: eventTypes, error, isLoading } = useListEventTypesQuery();
  const [reorder] = useReorderEventTypesMutation();

  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [overrideOrder, setOverrideOrder] = useState<EventTypeDTO[] | null>(null);
  const previousOrderRef = useRef<EventTypeDTO[] | null>(null);

  const list = overrideOrder ?? eventTypes ?? null;

  const filtered = useMemo(() => {
    if (!list) return null;
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((et) => {
      return (
        et.title.toLowerCase().includes(q) ||
        et.slug.toLowerCase().includes(q) ||
        (et.description ?? "").toLowerCase().includes(q) ||
        `${et.durationMinutes}m`.includes(q)
      );
    });
  }, [list, query]);

  if (error) {
    return (
      <div>
        <PageHeader title="Event types" description="Couldn't reach the API." />
        <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          Could not load event types.
        </div>
      </div>
    );
  }

  const totalCount = list?.length ?? 0;
  const isSearching = query.trim().length > 0;

  const onDragStart = (id: string) => (e: React.DragEvent) => {
    if (isSearching || !list) return;
    setDragId(id);
    previousOrderRef.current = list;
    setOverrideOrder(list);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const onDragOver = (overId: string) => (e: React.DragEvent) => {
    if (isSearching || !dragId || dragId === overId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(overId);
  };

  const onDragLeave = (overId: string) => () => {
    if (dragOverId === overId) setDragOverId(null);
  };

  const onDrop = (overId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (isSearching || !dragId || !list || dragId === overId) {
      setDragOverId(null);
      return;
    }
    const fromIdx = list.findIndex((et) => et.id === dragId);
    const toIdx = list.findIndex((et) => et.id === overId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setOverrideOrder(next);
    setDragOverId(null);
  };

  const onDragEnd = () => {
    const before = previousOrderRef.current;
    const after = overrideOrder;
    setDragId(null);
    setDragOverId(null);
    if (!before || !after) return;
    const changed = before.some((et, i) => after[i]?.id !== et.id);
    if (!changed) {
      setOverrideOrder(null);
      return;
    }
    reorder(after.map((et) => et.id))
      .unwrap()
      .then(() => setOverrideOrder(null))
      .catch((err) => {
        toast.error(
          err?.data?.error ?? "Failed to save order",
        );
        setOverrideOrder(before);
      });
  };

  return (
    <div className="font-sans">
      <PageHeader
        title="Event types"
        description="Configure different events for people to book on your calendar."
        descriptionClassName="text-white"
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="h-9 w-48 rounded-xl pl-8 focus-visible:border-gray-400 focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-0"
                disabled={totalCount === 0}
              />
            </div>
            <Button className="rounded-xl" asChild>
              <Link href="/event-types/new">
                <Plus className="h-4 w-4 text-gray-600" />
                New
              </Link>
            </Button>
          </div>
        }
      />

      {isLoading || !list ? (
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
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {filtered!.map((et) => (
            <EventTypeCard
              key={et.id}
              eventType={et}
              username={me?.username ?? ""}
              draggable={!isSearching}
              isDragging={dragId === et.id}
              isDragOver={dragOverId === et.id}
              onDragStart={onDragStart(et.id)}
              onDragOver={onDragOver(et.id)}
              onDragLeave={onDragLeave(et.id)}
              onDrop={onDrop(et.id)}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}
