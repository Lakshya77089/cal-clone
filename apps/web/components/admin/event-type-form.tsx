"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import type { EventTypeDTO, ScheduleDTO } from "@cal/shared";

type Props = {
  mode: "create" | "edit";
  initial?: EventTypeDTO;
  schedules: ScheduleDTO[];
  username: string;
};

const DURATION_PRESETS = [15, 30, 45, 60];

export function EventTypeForm({ mode, initial, schedules, username }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial?.title ?? "");
  // Slug is derived from the title on create (server-authoritative) and
  // locked after creation. The field shown here is read-only for transparency
  // about what URL the visitor will hit.
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 30);
  const [scheduleId, setScheduleId] = useState(initial?.scheduleId ?? schedules[0]?.id ?? "");
  const [bufferBefore, setBufferBefore] = useState(initial?.bufferBefore ?? 0);
  const [bufferAfter, setBufferAfter] = useState(initial?.bufferAfter ?? 0);
  // hidden=true → event doesn't appear in the host's public profile listing,
  // but the direct booking link still works (cal.com's "secret event type").
  const [hidden, setHidden] = useState(initial?.hidden ?? false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleId) {
      toast.error("Pick an availability schedule");
      return;
    }
    // Note: slug is intentionally not sent. On create the server derives it
    // from the title; on update it's immutable.
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      durationMinutes: duration,
      scheduleId,
      bufferBefore,
      bufferAfter,
      hidden,
    };
    startTransition(async () => {
      try {
        if (mode === "create") {
          const created = await api.eventTypes.create(body);
          toast.success("Event type created");
          router.push(`/event-types/${created.id}`);
        } else if (initial) {
          await api.eventTypes.update(initial.id, body);
          toast.success("Saved");
          router.refresh();
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to save");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Header bar: lives above the form card and mirrors cal.com's
          EventTypeSingleLayout header. The Hidden toggle is part of the same
          submit so it persists with one Save click. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Switch
            id="hidden"
            checked={hidden}
            onCheckedChange={setHidden}
            aria-label="Hide event type from profile"
          />
          <label htmlFor="hidden" className="cursor-pointer text-sm">
            <span className="font-medium">Hidden</span>
            <span className="ml-2 text-muted-foreground">
              {hidden
                ? "Not listed on your profile — direct link still works"
                : "Visible on your profile"}
            </span>
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-6 rounded-lg border border-border bg-white p-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          required
          maxLength={120}
          placeholder="Quick Chat"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            // Preview the slug the server will assign. The server is still
            // authoritative (and will add -2/-3 etc. on collision); this just
            // gives the user a sense of what URL they're about to publish.
            if (mode === "create") {
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9\s-]/g, "")
                  .trim()
                  .replace(/\s+/g, "-")
                  .replace(/-+/g, "-")
                  .slice(0, 60),
              );
            }
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">URL</Label>
        <div className="flex overflow-hidden rounded-md border border-input bg-muted/40 shadow-sm">
          <span className="flex items-center bg-muted px-3 text-xs text-muted-foreground">
            /{username}/
          </span>
          <Input
            id="slug"
            readOnly
            tabIndex={-1}
            placeholder={mode === "create" ? "(generated from title)" : ""}
            value={slug}
            className="rounded-none border-0 bg-transparent text-muted-foreground shadow-none focus-visible:ring-0"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          The URL is derived from the title and stays the same after creation,
          so links you’ve shared keep working.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={3}
          maxLength={2000}
          placeholder="A 30-minute focused call."
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Duration</Label>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDuration(m)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                duration === m
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-white text-foreground hover:bg-muted"
              }`}
            >
              {m} min
            </button>
          ))}
          <Input
            type="number"
            min={5}
            max={480}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 30)}
            className="w-24"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="schedule">Availability schedule</Label>
        <Select value={scheduleId} onValueChange={setScheduleId}>
          <SelectTrigger id="schedule">
            <SelectValue placeholder="Pick a schedule" />
          </SelectTrigger>
          <SelectContent>
            {schedules.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.timezone})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bufferBefore">Buffer before (min)</Label>
          <Input
            id="bufferBefore"
            type="number"
            min={0}
            max={120}
            value={bufferBefore}
            onChange={(e) => setBufferBefore(Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bufferAfter">Buffer after (min)</Label>
          <Input
            id="bufferAfter"
            type="number"
            min={0}
            max={120}
            value={bufferAfter}
            onChange={(e) => setBufferAfter(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      </div>
    </form>
  );
}
