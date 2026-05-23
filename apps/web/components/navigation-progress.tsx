"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin top-of-page progress bar shown while navigating to a new route.
 *
 * App Router doesn't expose router events, so we listen for:
 *   - clicks on internal anchors (start the bar)
 *   - pathname/searchParams changing (end the bar, the new route mounted)
 *
 * Also exposes an imperative `window.startNavProgress()` for any code that
 * triggers `router.push()` outside of an anchor click.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const start = () => {
      setActive(true);
      setWidth(8);
      // Climb toward 90% over a few hundred ms to feel "alive".
      requestAnimationFrame(() => setWidth(60));
      setTimeout(() => setWidth(90), 350);
    };

    const handleClick = (e: MouseEvent) => {
      // Only react to plain left-clicks on internal links.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const target = (e.target as Element | null)?.closest?.("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      // External link → let browser navigate, no bar
      if (target.getAttribute("target") === "_blank") return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }
      } catch {
        return;
      }
      start();
    };

    document.addEventListener("click", handleClick, true);
    (window as Window & { startNavProgress?: () => void }).startNavProgress = start;

    return () => {
      document.removeEventListener("click", handleClick, true);
      delete (window as Window & { startNavProgress?: () => void }).startNavProgress;
    };
  }, []);

  // When route actually changes, finish the bar.
  useEffect(() => {
    if (!active) return;
    setWidth(100);
    const t = setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[100] h-0.5 w-full"
    >
      <div
        className="h-full bg-foreground transition-[width,opacity] duration-300"
        style={{
          width: `${width}%`,
          opacity: active ? 1 : 0,
        }}
      />
    </div>
  );
}
