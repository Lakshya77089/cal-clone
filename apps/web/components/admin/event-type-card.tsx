"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Copy, EyeOff, ExternalLink, GripVertical, MoreVertical, Trash2 } from "lucide-react";
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
import {
  useDeleteEventTypeMutation,
  useUpdateEventTypeMutation,
} from "@/lib/api/calApi";
import type { EventTypeDTO } from "@cal/shared";

export function EventTypeCard({
  eventType,
  username,
  draggable,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  eventType: EventTypeDTO;
  username: string;
  draggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [updateEt, updateState] = useUpdateEventTypeMutation();
  const [deleteEt, deleteState] = useDeleteEventTypeMutation();
  const pending = updateState.isLoading || deleteState.isLoading;
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
    updateEt({ id: eventType.id, body: { hidden: nextHidden } })
      .unwrap()
      .catch((err) => {
        setHidden(!nextHidden);
        toast.error(err?.data?.error ?? "Failed to update");
      });
  };

  const onDelete = () => {
    startTransition(async () => {
      try {
        await deleteEt(eventType.id).unwrap();
        toast.success("Event type deleted");
        setConfirmDelete(false);
        router.refresh();
      } catch (err) {
        const e = err as { data?: { error?: string } };
        toast.error(e?.data?.error ?? "Failed to delete");
      }
    });
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-2 bg-muted/80 px-4 py-5 transition-colors hover:bg-muted/50 ${isDragging ? "opacity-40" : ""} ${isDragOver ? "ring-2 ring-inset ring-primary/60" : ""}`}
    >
      {draggable && (
        <span
          className="flex h-6 w-6 cursor-grab items-center justify-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <Link href={`/event-types/${eventType.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="truncate text-sm font-semibold">{eventType.title}</h3>
          <span className="truncate text-sm text-muted-foreground">
            /{username}/{eventType.slug}
          </span>
        </div>
        {/* {eventType.description && (
          <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">
            {eventType.description}
          </p>
        )} */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted border border-white/10 px-1.5 py-0.5 text-xs font-medium text-white">
            <Clock className="h-3 w-3" />
            {eventType.durationMinutes}m
          </span>
          {hidden && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-500">
              <EyeOff className="h-3 w-3" />
              Hidden
            </span>
          )}
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1.5">
        <Switch
          checked={!hidden}
          onCheckedChange={onToggleVisible}
          disabled={pending}
          title={hidden ? "Hidden from profile" : "Visible on profile"}
        />

        <div className="ml-2 flex items-center rounded-md border border-border">
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="Preview"
            className="h-9 w-9 rounded-none rounded-l-md border-r border-border"
          >
            <Link href={`/${username}/${eventType.slug}`} target="_blank">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopy}
            title="Copy link"
            className="h-9 w-9 rounded-none border-r border-border"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none rounded-r-md">
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
