"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TimezonePicker } from "@/components/shared/timezone-picker";
import { api, ApiError } from "@/lib/api";
import {
  WEEKDAY_LABELS_LONG,
  formatMinute,
  parseMinute,
} from "@/lib/utils";
import type { ScheduleDTO } from "@cal/shared";

type RangeUI = { startMinute: number; endMinute: number };
type Overrides = { date: string; startMinute: number | null; endMinute: number | null }[];

export function ScheduleEditor({ schedule }: { schedule: ScheduleDTO }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(schedule.name);
  const [timezone, setTimezone] = useState(schedule.timezone);

  // Group rules by weekday for the UI.
  const [byDay, setByDay] = useState<RangeUI[][]>(() => {
    const out: RangeUI[][] = Array.from({ length: 7 }, () => []);
    for (const r of schedule.rules) {
      out[r.weekday].push({ startMinute: r.startMinute, endMinute: r.endMinute });
    }
    for (const day of out) day.sort((a, b) => a.startMinute - b.startMinute);
    return out;
  });

  const [overrides, setOverrides] = useState<Overrides>(
    () =>
      schedule.overrides.map((o) => ({
        date: o.date,
        startMinute: o.startMinute,
        endMinute: o.endMinute,
      })),
  );

  const toggleDay = (wd: number) => {
    setByDay((prev) => {
      const next = [...prev];
      next[wd] = next[wd].length === 0 ? [{ startMinute: 9 * 60, endMinute: 17 * 60 }] : [];
      return next;
    });
  };

  const updateRange = (wd: number, i: number, field: "startMinute" | "endMinute", val: number) => {
    setByDay((prev) => {
      const next = [...prev];
      next[wd] = next[wd].map((r, idx) => (idx === i ? { ...r, [field]: val } : r));
      return next;
    });
  };

  const addRange = (wd: number) => {
    setByDay((prev) => {
      const next = [...prev];
      const last = next[wd][next[wd].length - 1];
      const newStart = last ? Math.min(last.endMinute + 60, 23 * 60) : 9 * 60;
      next[wd] = [...next[wd], { startMinute: newStart, endMinute: Math.min(newStart + 60, 24 * 60) }];
      return next;
    });
  };

  const removeRange = (wd: number, i: number) => {
    setByDay((prev) => {
      const next = [...prev];
      next[wd] = next[wd].filter((_, idx) => idx !== i);
      return next;
    });
  };

  const copyToAll = (wd: number) => {
    setByDay((prev) => prev.map((_, idx) => (idx === wd ? prev[idx] : [...prev[wd]])));
    toast.success("Copied to all weekdays");
  };

  const addOverride = () => {
    const today = new Date().toISOString().slice(0, 10);
    setOverrides((prev) => [...prev, { date: today, startMinute: null, endMinute: null }]);
  };

  const updateOverride = (i: number, patch: Partial<Overrides[number]>) => {
    setOverrides((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  };

  const removeOverride = (i: number) => {
    setOverrides((prev) => prev.filter((_, idx) => idx !== i));
  };

  const onSave = () => {
    // Validate ranges in-place.
    for (let wd = 0; wd < 7; wd++) {
      for (const r of byDay[wd]) {
        if (r.endMinute <= r.startMinute) {
          toast.error(`${WEEKDAY_LABELS_LONG[wd]}: end time must be after start`);
          return;
        }
      }
    }
    for (const o of overrides) {
      if (
        (o.startMinute === null) !== (o.endMinute === null) ||
        (o.startMinute !== null && o.endMinute !== null && o.endMinute <= o.startMinute)
      ) {
        toast.error(`Override ${o.date}: invalid time range`);
        return;
      }
    }

    const rules = byDay.flatMap((ranges, weekday) =>
      ranges.map((r) => ({ weekday, startMinute: r.startMinute, endMinute: r.endMinute })),
    );

    startTransition(async () => {
      try {
        await api.schedules.update(schedule.id, {
          name,
          timezone,
          rules,
          overrides,
        });
        toast.success("Availability saved");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to save");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-lg border border-border bg-white p-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Schedule name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tz">Timezone</Label>
          <TimezonePicker id="tz" value={timezone} onChange={setTimezone} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {byDay.map((ranges, wd) => {
          const enabled = ranges.length > 0;
          return (
            <div
              key={wd}
              className="flex flex-wrap items-start gap-3 border-b border-border px-6 py-4 last:border-0"
            >
              <div className="flex w-32 shrink-0 items-center gap-3">
                <Switch checked={enabled} onCheckedChange={() => toggleDay(wd)} />
                <span className="text-sm font-medium">{WEEKDAY_LABELS_LONG[wd]}</span>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {!enabled ? (
                  <span className="text-sm text-muted-foreground">Unavailable</span>
                ) : (
                  ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <TimeInput
                        value={r.startMinute}
                        onChange={(v) => updateRange(wd, i, "startMinute", v)}
                      />
                      <span className="text-muted-foreground">–</span>
                      <TimeInput
                        value={r.endMinute}
                        onChange={(v) => updateRange(wd, i, "endMinute", v)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRange(wd, i)}
                        title="Remove range"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {enabled && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => addRange(wd)}
                    title="Add range"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToAll(wd)}
                    title="Copy to other days"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-white">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold">Date overrides</h3>
            <p className="text-xs text-muted-foreground">
              Block specific dates or set different hours for a day.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addOverride}>
            <Plus className="mr-1 h-4 w-4" /> Add override
          </Button>
        </div>

        {overrides.length === 0 ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">No overrides yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {overrides.map((o, i) => {
              const blocked = o.startMinute === null && o.endMinute === null;
              return (
                <div key={i} className="flex flex-wrap items-center gap-3 px-6 py-3">
                  <Input
                    type="date"
                    value={o.date}
                    onChange={(e) => updateOverride(i, { date: e.target.value })}
                    className="w-40"
                  />
                  <Switch
                    checked={!blocked}
                    onCheckedChange={(on) =>
                      updateOverride(
                        i,
                        on
                          ? { startMinute: 9 * 60, endMinute: 17 * 60 }
                          : { startMinute: null, endMinute: null },
                      )
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {blocked ? "Blocked all day" : "Custom hours"}
                  </span>
                  {!blocked && (
                    <>
                      <TimeInput
                        value={o.startMinute ?? 9 * 60}
                        onChange={(v) => updateOverride(i, { startMinute: v })}
                      />
                      <span className="text-muted-foreground">–</span>
                      <TimeInput
                        value={o.endMinute ?? 17 * 60}
                        onChange={(v) => updateOverride(i, { endMinute: v })}
                      />
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOverride(i)}
                    className="ml-auto"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function TimeInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const display = formatMinute(value, true); // 24h for input precision
  return (
    <Input
      type="time"
      value={display}
      onChange={(e) => {
        const parsed = parseMinute(e.target.value);
        if (parsed !== null) onChange(parsed);
      }}
      className="w-28"
    />
  );
}
