"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import { Calendar, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { PublicProfileDTO } from "@cal/shared";

export function BookingForm({
  profile,
  startTime,
  viewerTimezone,
}: {
  profile: PublicProfileDTO;
  startTime: string;
  viewerTimezone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const booking = await api.bookings.create({
        eventTypeId: profile.eventType.id,
        startTime,
        attendeeName: name.trim(),
        attendeeEmail: email.trim(),
        attendeeNotes: notes.trim() || null,
        attendeeTimezone: viewerTimezone,
      });
      router.push(`/booking/${booking.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to book");
      setSubmitting(false);
    }
  };

  const startDate = new Date(startTime);
  const slotLabel = `${formatInTimeZone(startDate, viewerTimezone, "EEEE, MMMM d, yyyy")} · ${formatInTimeZone(startDate, viewerTimezone, "h:mm a")}`;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 p-6">
      <Link
        href={`/${profile.user.username}/${profile.eventType.slug}?tz=${encodeURIComponent(viewerTimezone)}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> Back
      </Link>

      <div className="rounded-md border border-border bg-muted/50 p-3">
        <p className="flex items-start gap-2 text-sm font-medium">
          <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <span>{slotLabel}</span>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Your name *</Label>
        <Input
          id="name"
          required
          maxLength={120}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Additional notes</Label>
        <Textarea
          id="notes"
          rows={3}
          maxLength={2000}
          placeholder="Anything else the host should know?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Booking…" : "Confirm booking"}
        </Button>
      </div>
    </form>
  );
}
