import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api";

export default async function PublicProfilePage({
  params,
}: {
  params: { username: string };
}) {
  let profile: Awaited<ReturnType<typeof api.publicUser>>;
  try {
    profile = await api.publicUser(params.username);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { user, eventTypes } = profile;
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Profile card */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-xl font-medium text-background">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-semibold">{user.name}</h1>
              <p className="text-sm text-muted-foreground">cal/{user.username}</p>
            </div>
          </div>
        </div>

        {/* Event-type list */}
        {eventTypes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
            This user hasn’t published any event types yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {eventTypes.map((et) => (
              <Link
                key={et.id}
                href={`/${user.username}/${et.slug}`}
                className="group block border-b border-border p-5 transition-colors hover:bg-muted/40 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-foreground">{et.title}</h2>
                    {et.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {et.description}
                      </p>
                    )}
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {et.durationMinutes} mins
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
