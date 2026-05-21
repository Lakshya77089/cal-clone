import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";

export default async function HomePage() {
  let username: string | null = null;
  try {
    const me = await api.me();
    username = me.username;
  } catch {
    // API unreachable or DB unseeded — keep going with a friendly landing page.
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-white p-10 shadow-sm">
        <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
          <CalendarClock className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Cal Clone</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A scheduling platform built as a clone of cal.com. Manage event types,
          set your availability, and share a public booking link.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/event-types">Open dashboard</Link>
          </Button>
          {username && (
            <Button asChild variant="secondary">
              <Link href={`/${username}/30min`}>See your public page</Link>
            </Button>
          )}
        </div>

        {!username && (
          <p className="mt-6 text-xs text-muted-foreground">
            Tip: run <code className="rounded bg-muted px-1 py-0.5">npm run seed</code>
            {" "}from the project root to populate the demo user and sample data.
          </p>
        )}
      </div>
    </main>
  );
}
