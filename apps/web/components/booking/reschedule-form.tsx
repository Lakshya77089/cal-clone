"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRescheduleBookingMutation } from "@/lib/api/calApi";

export function RescheduleForm({
  bookingId,
  startTime,
  viewerTimezone,
  defaultName,
  defaultEmail,
}: {
  bookingId: string;
  startTime: string;
  viewerTimezone: string;
  defaultName: string;
  defaultEmail: string;
}) {
  const router = useRouter();
  const [name] = useState(defaultName);
  const [email] = useState(defaultEmail);
  const [reason, setReason] = useState("");
  const [guests, setGuests] = useState<string[] | null>(null);
  const [reschedule, reschState] = useRescheduleBookingMutation();
  const submitting = reschState.isLoading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await reschedule({
        id: bookingId,
        body: { startTime, reason: reason.trim() || null },
      }).unwrap();
      router.push(`/booking/${created.id}`);
    } catch (err) {
      const e = err as { data?: { error?: string } };
      toast.error(e?.data?.error ?? "Failed to reschedule");
    }
  };

  const updateGuest = (idx: number, value: string) => {
    setGuests((prev) => {
      const next = [...(prev ?? [])];
      next[idx] = value;
      return next;
    });
  };

  const removeGuest = (idx: number) => {
    setGuests((prev) => {
      if (!prev) return prev;
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? null : next;
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 p-6">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-semibold">
          Your name
        </Label>
        <Input
          id="name"
          value={name}
          disabled
          className="bg-background text-muted-foreground"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-semibold">
          Email address
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          disabled
          className="bg-background text-muted-foreground"
        />
      </div>

      {guests === null ? (
        <button
          type="button"
          onClick={() => setGuests([""])}
          className="inline-flex items-center gap-2 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <UserPlus className="h-4 w-4" />
          Add guests
        </button>
      ) : (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Add guests</Label>
          {guests.map((g, idx) => (
            <div key={idx} className="relative">
              <Input
                type="email"
                placeholder="Email"
                value={g}
                onChange={(e) => updateGuest(idx, e.target.value)}
                className="bg-background pr-9"
              />
              <button
                type="button"
                onClick={() => removeGuest(idx)}
                aria-label="Remove guest"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setGuests((prev) => [...(prev ?? []), ""])}
            disabled={guests.length >= 10}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Add another
          </button>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reason" className="text-sm font-semibold">
          Reason for reschedule
        </Label>
        <Textarea
          id="reason"
          rows={3}
          maxLength={2000}
          placeholder="Let others know why you need to reschedule"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="resize-none bg-background"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        By proceeding, you agree to Cal.com&rsquo;s{" "}
        <a href="#" className="font-medium text-foreground underline-offset-2 hover:underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="#" className="font-medium text-foreground underline-offset-2 hover:underline">
          Privacy Policy
        </a>
        .
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Back
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Rescheduling…" : "Reschedule"}
        </Button>
      </div>

      <input type="hidden" value={viewerTimezone} readOnly aria-hidden="true" />
    </form>
  );
}
