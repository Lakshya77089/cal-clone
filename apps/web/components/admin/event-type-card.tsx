"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Copy, EyeOff, ExternalLink, MoreVertical, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import type { EventTypeDTO } from "@cal/shared";

export function EventTypeCard({
  eventType,
  username,
}: {
  eventType: EventTypeDTO;
  username: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Tracks the "Hidden" toggle locally for an optimistic UI. Same semantics
  // as cal.com: hidden=true hides from public profile, direct link still works.
  const [hidden, setHidden] = useState(eventType.hidden);

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/${username}/${eventType.slug}`
    : `/${username}/${eventType.slug}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  // The row switch is "visible on profile" (NOT hidden), so flipping the
  // toggle off sets hidden=true. We flip it on the wire and store the inverse.
  const onToggleVisible = (visible: boolean) => {
    const nextHidden = !visible;
    setHidden(nextHidden);
    startTransition(async () => {
      try {
        await api.eventTypes.update(eventType.id, { hidden: nextHidden });
        router.refresh();
      } catch (err) {
        setHidden(!nextHidden);
        toast.error(err instanceof ApiError ? err.message : "Failed to update");
      }
    });
  };

  const onDelete = () => {
    startTransition(async () => {
      try {
        await api.eventTypes.remove(eventType.id);
        toast.success("Event type deleted");
        setConfirmDelete(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to delete");
      }
    });
  };

  return (
    <div
      className={`flex items-center gap-4 border-b border-border bg-card px-6 py-5 transition-colors first:rounded-t-lg last:rounded-b-lg last:border-0 hover:bg-muted/40 ${hidden ? "opacity-60" : ""}`}
    >
      <Link href={`/event-types/${eventType.id}`} className="min-w-0 flex-1">
        {/* Title + slug on the same line, mirroring cal.com's row layout */}
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="truncate text-base font-semibold">{eventType.title}</h3>
          <span className="truncate text-sm text-muted-foreground">
            /{username}/{eventType.slug}
          </span>
        </div>
        {/* Meta row: duration + (optional) Hidden badge, mirroring screenshot */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {eventType.durationMinutes}m
          </span>
          {hidden && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">
              <EyeOff className="h-3 w-3" />
              Hidden
            </span>
          )}
        </div>
        {eventType.description && (
          <p className="mt-1 truncate text-sm text-muted-foreground/80">{eventType.description}</p>
        )}
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        <Switch
          checked={!hidden}
          onCheckedChange={onToggleVisible}
          disabled={pending}
          title={hidden ? "Hidden from profile" : "Visible on profile"}
        />

        <Button variant="secondary" size="icon" onClick={onCopy} title="Copy link">
          <Copy className="h-4 w-4" />
        </Button>

        <Button variant="secondary" size="icon" asChild title="Preview">
          <Link href={`/${username}/${eventType.slug}`} target="_blank">
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => router.push(`/event-types/${eventType.id}`)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onCopy}>Copy link</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setConfirmDelete(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete event type?</DialogTitle>
            <DialogDescription>
              This permanently removes &ldquo;{eventType.title}&rdquo; and all related bookings.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
