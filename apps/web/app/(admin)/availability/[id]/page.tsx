import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { ScheduleEditor } from "@/components/admin/schedule-editor";
import { api, ApiError } from "@/lib/api";

export default async function ScheduleEditPage({
  params,
}: {
  params: { id: string };
}) {
  let schedule;
  try {
    schedule = await api.schedules.get(params.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  return (
    <div>
      <Link
        href="/availability"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader
        title={schedule.name}
        description="Set the times when this schedule is available for bookings."
      />
      <ScheduleEditor schedule={schedule} />
    </div>
  );
}
