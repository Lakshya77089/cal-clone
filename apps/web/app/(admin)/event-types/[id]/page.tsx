import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EventTypeForm } from "@/components/admin/event-type-form";
import { api, ApiError } from "@/lib/api";

export default async function EditEventTypePage({
  params,
}: {
  params: { id: string };
}) {
  let eventType;
  try {
    eventType = await api.eventTypes.get(params.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const [schedules, me] = await Promise.all([api.schedules.list(), api.me()]);

  return (
    <div>
      <Link
        href="/event-types"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader
        title={eventType.title}
        description={`Edit your "${eventType.title}" event type.`}
      />
      <EventTypeForm mode="edit" initial={eventType} schedules={schedules} username={me.username} />
    </div>
  );
}
