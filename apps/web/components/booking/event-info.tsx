import Image from "next/image";
import { CalendarDays, ChevronDown, Clock, Globe, Video } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import type { PublicProfileDTO } from "@cal/shared";

export function EventInfo({
  profile,
  viewerTimezone,
  startTime,
  formerStartTime,
}: {
  profile: PublicProfileDTO;
  viewerTimezone: string;
  startTime?: string;
  formerStartTime?: string;
}) {
  const avatarUrl = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(profile.user.username)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  return (
    <div className="border-b border-border p-6 md:border-b-0 md:border-r">
      <div className="mb-4">
        <Image
          src={avatarUrl}
          alt={profile.user.name}
          width={40}
          height={40}
          unoptimized
          className="h-10 w-10 rounded-full border border-border bg-muted"
        />
      </div>
      <p className="text-sm text-muted-foreground">{profile.user.name}</p>
      <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight">
        {profile.eventType.title}
      </h1>
      <ul className="mt-6 space-y-3 text-sm text-foreground">
        {startTime && (
          <li className="flex items-start gap-2 font-semibold">
            <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <div>
                {formatInTimeZone(new Date(startTime), viewerTimezone, "EEEE, MMMM d, yyyy")}
              </div>
              <div>
                {formatInTimeZone(new Date(startTime), viewerTimezone, "h:mm")} &ndash;{" "}
                {formatInTimeZone(
                  new Date(new Date(startTime).getTime() + profile.eventType.durationMinutes * 60000),
                  viewerTimezone,
                  "h:mm a",
                ).toLowerCase()}
              </div>
            </div>
          </li>
        )}
        {formerStartTime && (
          <li className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-semibold">Former time</div>
              <div className="text-muted-foreground line-through">
                {formatInTimeZone(new Date(formerStartTime), viewerTimezone, "EEEE, MMMM d, yyyy")}
              </div>
              <div className="text-muted-foreground line-through">
                {formatInTimeZone(new Date(formerStartTime), viewerTimezone, "h:mm a").toLowerCase()}
              </div>
            </div>
          </li>
        )}
        <li className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {profile.eventType.durationMinutes}m
        </li>
        <li className="flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          Cal Video
        </li>
        <li className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          {viewerTimezone}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </li>
      </ul>
    </div>
  );
}
