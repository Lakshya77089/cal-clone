"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  CalendarRange,
  Clock,
  LayoutGrid,
  LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/event-types", label: "Event Types", icon: LayoutGrid },
  { href: "/bookings", label: "Bookings", icon: CalendarRange },
  { href: "/availability", label: "Availability", icon: Clock },
];

type Me = { name: string; username: string };

export function Sidebar({ me }: { me: Me | null }) {
  const pathname = usePathname();
  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-white md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
          <CalendarClock className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">Cal Clone</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {me && (
        <div className="border-t border-border p-4">
          <Link
            href={`/${me.username}`}
            className="flex items-center gap-3 rounded-md p-2 text-sm hover:bg-muted"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {me.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">{me.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <LinkIcon className="h-3 w-3" />
                cal/{me.username}
              </p>
            </div>
          </Link>
        </div>
      )}
    </aside>
  );
}
