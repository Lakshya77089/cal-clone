import { Clock, Globe, Video } from "lucide-react";
import type { PublicProfileDTO } from "@cal/shared";

export function EventInfo({
  profile,
  viewerTimezone,
}: {
  profile: PublicProfileDTO;
  viewerTimezone: string;
}) {
  return (
    <div className="border-b border-border p-6 md:border-b-0 md:border-r">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-lg font-medium text-background">
        {profile.user.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </div>
      <p className="text-sm text-muted-foreground">{profile.user.name}</p>
      <h1 className="mt-1 text-xl font-semibold leading-tight">{profile.eventType.title}</h1>
      {profile.eventType.description && (
        <p className="mt-3 text-sm text-muted-foreground">{profile.eventType.description}</p>
      )}

      <ul className="mt-4 space-y-2 text-sm text-foreground/80">
        <li className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {profile.eventType.durationMinutes} mins
        </li>
        <li className="flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          Cal Video
        </li>
        <li className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          {viewerTimezone}
        </li>
      </ul>
    </div>
  );
}
