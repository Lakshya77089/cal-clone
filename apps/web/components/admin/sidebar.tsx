"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarRange,
  ChevronsUpDown,
  Clock,
  Copy,
  ExternalLink,
  LayoutGrid,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/event-types", label: "Event types", icon: LayoutGrid },
  { href: "/bookings", label: "Bookings", icon: CalendarRange },
  { href: "/availability", label: "Availability", icon: Clock },
];

type Me = { name: string; username: string };

export function Sidebar({ me }: { me: Me | null }) {
  const pathname = usePathname();
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const onCopyPublicLink = async () => {
    if (!me) return;
    try {
      const url = `${window.location.origin}/${me.username}`;
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      toast.success("Public page link copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
      {/* Top: avatar pill + username (mirrors cal.com's "lakshya shar... v" header) */}
      {me && (
        <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-3">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-muted"
            // The dropdown trigger is visual-only in this no-login app — no menu
            // attached. Matches cal.com's affordance without faking unused options.
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase">
              {me.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </span>
            <span className="truncate text-sm font-medium">{me.name.toLowerCase()}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Middle: nav */}
      <nav className="flex-1 space-y-0.5 p-2">
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

      {/* Bottom: public-page actions + footer */}
      {me && (
        <div className="space-y-0.5 border-t border-border p-2">
          <Link
            href={`/${me.username}`}
            target="_blank"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            View public page
          </Link>
          <button
            type="button"
            onClick={onCopyPublicLink}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Copy className="h-4 w-4" />
            {copyState === "copied" ? "Copied!" : "Copy public page link"}
          </button>
          {/* Settings is visually present but doesn't navigate anywhere in
              this no-login build — cal.com's Settings page covers auth, billing,
              integrations etc., which are out of assignment scope. */}
          <button
            type="button"
            onClick={() => toast.info("Settings page isn't part of this build.")}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      )}
    </aside>
  );
}
