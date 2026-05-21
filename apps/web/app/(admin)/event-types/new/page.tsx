import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EventTypeForm } from "@/components/admin/event-type-form";
import { api } from "@/lib/api";

export default async function NewEventTypePage() {
  const [schedules, me] = await Promise.all([api.schedules.list(), api.me()]);
  if (schedules.length === 0) {
    redirect("/availability");
  }
  return (
    <div>
      <Link
        href="/event-types"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader title="New event type" description="Add a new way for people to book time with you." />
      <EventTypeForm mode="create" schedules={schedules} username={me.username} />
    </div>
  );
}
