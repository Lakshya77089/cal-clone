import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { EventTypeCard } from "@/components/admin/event-type-card";
import { api } from "@/lib/api";

export default async function EventTypesPage() {
  let me: { username: string };
  let eventTypes: Awaited<ReturnType<typeof api.eventTypes.list>>;
  try {
    me = await api.me();
    eventTypes = await api.eventTypes.list();
  } catch {
    return (
      <div>
        <PageHeader title="Event Types" description="Couldn't reach the API." />
        <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          Make sure the API is running on{" "}
          <code className="rounded bg-muted px-1 py-0.5">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}</code>{" "}
          and that you&rsquo;ve seeded the database with{" "}
          <code className="rounded bg-muted px-1 py-0.5">npm run seed</code>.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Event Types"
        description="Create events to share for people to book on your calendar."
        action={
          <Button asChild>
            <Link href="/event-types/new">
              <Plus className="mr-1 h-4 w-4" /> New
            </Link>
          </Button>
        }
      />

      {eventTypes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No event types yet.</p>
          <Button asChild className="mt-4">
            <Link href="/event-types/new">Create your first</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {eventTypes.map((et) => (
            <EventTypeCard key={et.id} eventType={et} username={me.username} />
          ))}
        </div>
      )}
    </div>
  );
}
