"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezonePicker } from "@/components/shared/timezone-picker";
import { api, ApiError } from "@/lib/api";

export default function NewSchedulePage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [tz, setTz] = useState(
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const created = await api.schedules.create({
          name: name.trim() || "Working Hours",
          timezone: tz,
          isDefault: false,
          rules: [1, 2, 3, 4, 5].map((wd) => ({
            weekday: wd,
            startMinute: 9 * 60,
            endMinute: 17 * 60,
          })),
          overrides: [],
        });
        toast.success("Schedule created");
        router.push(`/availability/${created.id}`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to create");
      }
    });
  };

  return (
    <div>
      <Link
        href="/availability"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader title="New schedule" description="Start with Mon-Fri 9-5; refine after creating." />
      <form
        onSubmit={onSubmit}
        className="grid max-w-xl gap-4 rounded-lg border border-border bg-white p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Schedule name</Label>
          <Input
            id="name"
            placeholder="Working Hours"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tz">Timezone</Label>
          <TimezonePicker id="tz" value={tz} onChange={setTz} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
