# Cal.com Clone — Architecture Plan

## Context

Building a Cal.com clone for an SDE intern fullstack assignment, due in 2 days. Greenfield project in `d:\projects\cal` (empty). Must visually resemble Cal.com, implement event types, availability schedules, public booking with conflict prevention, and a bookings dashboard. Stack mandated: **Next.js + Tailwind + shadcn/ui + PostgreSQL + Prisma**. No auth — single seeded default user. Must deploy publicly.

The goal of this document is to lock in architecture **with trade-offs** before any code is written. Implementation follows in a separate phase.

---

## 1. Top-level architecture decision: Next.js fullstack vs split frontend/backend

| Option | Pros | Cons |
|---|---|---|
| A. Next.js App Router + API routes (single repo) | One deploy target, shared types, less boilerplate | Mixes UI and API; less of a backend showcase |
| **B. Next.js frontend + separate Express API (monorepo)** ← chosen | Clear separation, demonstrates backend skill independently, schema/services live in a service the evaluator can run standalone, two deploy URLs to show on the submission | Two deploys, CORS config, duplicated types unless shared, ~half a day extra |

**Decision: Option B (user choice).** Repo is laid out as a simple monorepo so the evaluator sees `apps/web/` (Next.js) and `apps/api/` (Express) as first-class siblings. Types are shared via a `packages/types` workspace (or, if we don't want pnpm workspaces overhead, a `packages/shared/` folder imported relatively) so a Booking/EventType DTO doesn't drift between client and server.

**Trade-offs this introduces, and how we handle them:**
- **CORS**: API enables `cors({ origin: process.env.WEB_ORIGIN, credentials: false })`. Documented in README.
- **Type sharing**: a `packages/shared/src/types.ts` with the API request/response shapes, plus Zod schemas reused in both places. The frontend imports Zod for client-side form validation, the backend uses the same schemas to validate request bodies — single source of truth.
- **Local dev**: `pnpm dev` at repo root runs both with `concurrently` (api on `:4000`, web on `:3000`).
- **Deploys**: Web → Vercel. API → Render (web service, free tier) or Railway. Neon Postgres shared by both — but realistically only the API talks to it (the web app never holds `DATABASE_URL`).

---

## 2. Rendering strategy: App Router vs Pages Router

| Option | Pros | Cons |
|---|---|---|
| **A. App Router** ← chosen | Modern Next.js default; server components can `fetch()` from our Express API at request time without exposing API URLs to the browser | Slight learning curve around server/client boundary |
| B. Pages Router | More tutorial coverage, familiar `getServerSideProps` | Legacy direction, more boilerplate |

**Decision: App Router.** Since the backend is separate, RSCs no longer query the DB directly — they `fetch()` the Express API server-side (using an `INTERNAL_API_URL` env var that points at the API in production, so the call doesn't round-trip through the public internet when the deploy environments are co-located). Mutations and the public booking-page interactions use client components calling the API directly via a small `lib/api.ts` typed fetch wrapper.

---

## 3. Database schema

Single user assumption simplifies things, but model `User` anyway so the schema is realistic and the assignment's "well-structured schema with proper relationships" criterion is met.

```
User
  id, name, email, username (unique), timezoneDefault, createdAt
  → eventTypes[], schedules[], bookings[]

EventType
  id, userId, title, slug (unique per user), description, durationMinutes,
  scheduleId (FK → Schedule, the availability used for this event),
  bufferBefore, bufferAfter, isActive, createdAt
  → bookings[]
  UNIQUE(userId, slug)

Schedule                              // an "availability schedule"
  id, userId, name, timezone, isDefault, createdAt
  → availabilityRules[], dateOverrides[]

AvailabilityRule                      // weekly recurring availability
  id, scheduleId, weekday (0-6), startMinute (0-1439), endMinute
  // Multiple rows per (scheduleId, weekday) = multiple ranges per day

DateOverride                          // bonus: block / change specific dates
  id, scheduleId, date (DATE), startMinute (nullable), endMinute (nullable)
  // both null = full-day block

Booking
  id, eventTypeId, attendeeName, attendeeEmail, attendeeNotes,
  startTime (TIMESTAMPTZ), endTime (TIMESTAMPTZ), status (enum:
  CONFIRMED|CANCELLED|RESCHEDULED), createdAt, cancelledAt, cancelReason
  INDEX(eventTypeId, startTime)
  // For conflict checking: query bookings where status=CONFIRMED
  // and time range overlaps. Enforce overlap at DB level via constraint.
```

**Trade-offs in this schema:**

- **Storing weekday + minutes (int 0–1439) vs storing TIME columns**: int math is trivial and timezone-free, avoiding date-vs-time mismatch bugs. The schedule's `timezone` column applies the wall-clock interpretation. ← chose int minutes.
- **Multiple ranges per day**: modeled as multiple rows rather than a JSON array. Cleaner, queryable, indexable, matches Cal.com's "+ Add range" behavior.
- **`scheduleId` on EventType (FK)**: each event uses one schedule. Supports the bonus "multiple availability schedules" cleanly with no schema change.
- **Booking times as `TIMESTAMPTZ`**: always store UTC, render in viewer's tz. Standard practice.
- **Soft-delete cancellation** (status=CANCELLED + cancelledAt) instead of row delete: needed for "View past bookings" including cancelled ones, and to prevent the cancelled slot from blocking re-booking.
- **No DB-level exclusion constraint for overlap** (Postgres `EXCLUDE USING gist`): correct but adds a btree_gist extension dependency that's annoying on free Postgres tiers (Neon supports it but it's another thing to remember). Instead, enforce in a **transactional `lib/booking.ts` create function** that re-checks overlap inside a transaction. Trade-off: slightly weaker guarantee under extreme concurrency, but acceptable for an assignment and easier to deploy. Note this in README.

---

## 4. Availability / slot computation — the one tricky algorithm

This is where most clones get hand-wavy. The function `getAvailableSlots(eventTypeId, dateRange)` must:

1. Load the EventType, its Schedule, its AvailabilityRules, and DateOverrides.
2. For each date in range: determine wall-clock open intervals in the schedule's timezone (rule for that weekday, or override if present).
3. Convert open intervals → UTC.
4. Subtract existing CONFIRMED bookings (with buffers applied).
5. Slice into discrete start times stepped by `durationMinutes` (Cal.com uses a fixed 15-min grid; we'll mirror that — step = `min(duration, 15)`).
6. Return as ISO strings in UTC; the client renders in the viewer's tz.

**Trade-off — handle timezones with raw Date math or pull a library?** A library. Use **`date-fns-tz`** (smaller than Luxon, integrates with shadcn's `Calendar` which uses `date-fns`). DIY tz math is the #1 bug source in scheduling apps.

**Trade-off — compute slots on every page click vs cache?** Compute on demand. With a single user and seed data this is microseconds. Caching is premature.

---

## 5. Booking conflict prevention

Inside `createBooking()`:

```
prisma.$transaction(async tx => {
  // 1. Re-resolve the requested slot is still in the available set
  // 2. SELECT FOR UPDATE on overlapping bookings for this eventType
  // 3. If any CONFIRMED overlap exists, throw SlotTakenError
  // 4. INSERT booking
})
```

Trade-off vs simpler "just insert and hope": the transaction adds maybe 5ms and prevents the demo-killing double-booking that an evaluator will absolutely try. Worth it.

---

## 6. Project structure — monorepo with split frontend/backend

```
cal/
├── apps/
│   ├── api/                        # Express + Prisma backend
│   │   ├── src/
│   │   │   ├── index.ts            # express app boot (cors, mounts routers)
│   │   │   ├── app.ts              # createApp() — composes routers + middleware
│   │   │   ├── db.ts               # prisma client singleton
│   │   │   ├── routes/
│   │   │   │   ├── eventTypes.ts   # GET/POST/PATCH/DELETE + POST /reorder
│   │   │   │   ├── schedules.ts    # /schedules (+ rules + overrides)
│   │   │   │   ├── bookings.ts     # /bookings (list, get, create, cancel, reschedule)
│   │   │   │   ├── slots.ts        # GET /slots?eventTypeId=...&from=...&to=...
│   │   │   │   ├── publicProfile.ts# GET /public/:username/:slug
│   │   │   │   └── me.ts           # GET /me — current single user
│   │   │   ├── services/
│   │   │   │   ├── availability.ts # getAvailableSlots() — slot algorithm
│   │   │   │   ├── booking.ts      # create/cancel/reschedule — transactional
│   │   │   │   └── notifications.ts# EmailJS fan-out to attendee, host, guests
│   │   │   ├── lib/
│   │   │   │   ├── time.ts         # date-fns-tz wrappers
│   │   │   │   ├── errors.ts       # HttpError, error middleware
│   │   │   │   ├── slug.ts         # slug derivation + uniqueness
│   │   │   │   ├── email.ts        # thin EmailJS REST wrapper
│   │   │   │   └── currentUser.ts  # resolves the single seeded host
│   │   │   └── middleware/
│   │   │       ├── validate.ts     # zod request body validator
│   │   │       └── errorHandler.ts # central JSON error response
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/         # versioned SQL migrations
│   │   │   └── seed.ts
│   │   ├── tests/                  # unit / module / integration (vitest)
│   │   ├── package.json
│   │   └── vitest.config.ts
│   │
│   └── web/                        # Next.js 14 App Router frontend
│       ├── app/
│       │   ├── (admin)/            # grouped admin layout w/ sidebar
│       │   │   ├── layout.tsx
│       │   │   ├── event-types/{page, [id]/page, new/page}.tsx
│       │   │   │            + event-types-client.tsx  (RTK Query)
│       │   │   ├── availability/{page, [id]/page, new/page}.tsx
│       │   │   │            + availability-client.tsx (RTK Query)
│       │   │   └── bookings/{page, bookings-client}.tsx (RTK Query)
│       │   ├── [username]/                  # public profile
│       │   │   ├── page.tsx
│       │   │   ├── loading.tsx              # skeleton
│       │   │   └── [eventSlug]/             # public booking
│       │   │       ├── page.tsx             # calendar + slots
│       │   │       ├── loading.tsx
│       │   │       └── book/page.tsx        # attendee form
│       │   ├── booking/[id]/                # confirmation
│       │   │   ├── page.tsx                 # RSC fetch
│       │   │   ├── booking-detail-client.tsx# inline cancel + cal links
│       │   │   └── loading.tsx
│       │   ├── reschedule/[id]/
│       │   │   ├── page.tsx                 # picker w/ former-time strikethrough
│       │   │   ├── form/page.tsx            # reschedule reason form
│       │   │   └── loading.tsx
│       │   ├── not-found.tsx                # chrome-style dino game on 404
│       │   ├── layout.tsx
│       │   └── globals.css
│       ├── components/
│       │   ├── ui/                 # shadcn primitives
│       │   ├── admin/              # sidebar, event-type-card, booking-list, ...
│       │   ├── booking/            # event-info, booking-picker, *-form, reschedule-client
│       │   ├── dino-game.tsx       # 404 game (canvas)
│       │   ├── navigation-progress.tsx  # top-of-page progress bar on link clicks
│       │   └── providers.tsx       # <ReduxProvider> + <NavigationProgress />
│       ├── lib/
│       │   ├── api.ts              # legacy typed fetch wrapper (used by RSCs)
│       │   ├── api/
│       │   │   └── calApi.ts       # RTK Query — one createApi for all endpoints
│       │   ├── slices/
│       │   │   └── uiSlice.ts      # small UI slice (sidebar, 12h/24h pref)
│       │   ├── store.ts            # configureStore + typed hooks
│       │   └── utils.ts            # cn() helper
│       ├── package.json
│       └── next.config.mjs
│
├── packages/
│   └── shared/                     # types + zod schemas shared between web & api
│       ├── src/
│       │   ├── schemas.ts          # zod for EventType, Booking, Schedule, ...
│       │   └── types.ts            # DTOs (BookingDTO has wasRescheduled flag, ...)
│       └── package.json
│
├── deploy.ps1                      # local one-shot push + ssh deploy helper
├── package.json                    # workspaces root, "dev": concurrently both apps
└── README.md
```

**Workspace tool trade-off:** pnpm vs npm workspaces. pnpm is faster and stricter, but the evaluator may not have it installed. **Use npm workspaces** — works out of the box with `npm install` at root, no extra prerequisite in setup instructions.

The boundary that matters: **Express route handlers stay thin and call `services/`.** Business logic (availability math, conflict checks, reschedule-chain walking) is testable in isolation without HTTP.

---

## 7. UI implementation strategy (per Cal.com research)

- shadcn components: `Button`, `Input`, `Textarea`, `Select`, `Switch`, `Tabs`, `Dialog`, `Form`, `DropdownMenu`, `Toast` (Sonner). The shadcn `Calendar` was replaced with a custom canvas-friendly grid (`booking-picker.tsx`) once we needed availability-aware date cells with stable styling.
- **Theme:** dark by default. Page bg `#0f0f0f` (`--background`), surfaces `#171717` (`--card`), borders `hsl(0 0% 16%)`, primary white-on-black. Matches the current cal.com dark mode.
- **Font:** Inter via `next/font/google`. Tailwind exposes both `font-sans` and `font-heading` (same Inter today; swap point if a display font is added later).
- **Admin sidebar:** fixed-width, icon+label nav (`Link` icon for Event types, `CalendarRange` for Bookings, `Clock` for Availability). Active state `bg-muted`.
- **Public booking page:** three-pane card (event info / month calendar / scrollable time slots), fixed-height so only the slot column scrolls. Calendar dates use a solid muted fill on available days, white-on-black on selection. Slot pills are rounded-lg buttons with a green dot indicator; clicking routes straight to `/book` instead of expanding inline (matches cal.com).
- **Time-slot interaction:** single click → navigate. The earlier "expand to two-button confirm" interaction was removed because cal.com itself navigates immediately.
- **Loading states:** Next.js `loading.tsx` siblings for every server-rendered route (`[username]`, `[username]/[eventSlug]`, `booking/[id]`, `reschedule/[id]`, `reschedule/[id]/form`) render skeletons that match the real layout, so the transition doesn't visually jump.
- **Navigation progress:** a top-of-page 0.5px bar (`components/navigation-progress.tsx`) appears on every internal link click and finishes when the destination route mounts. Intercepts anchor clicks at the document level; uses `usePathname()` + `useSearchParams()` to detect the route change.
- **404 page:** `app/not-found.tsx` renders a chrome-style pixel-art dino game (`components/dino-game.tsx`) — canvas-based, jump physics, persistent high score in `localStorage`.

---

## 7a. Client-side state management

Originally there was no global store — every client component fetched via `lib/api.ts` + `useEffect`. That stayed honest but didn't show off any data-layer thinking, so the codebase now uses:

- **Redux Toolkit + RTK Query** (`lib/store.ts`, `lib/api/calApi.ts`) as the single client data layer. One `createApi` covers every endpoint; mutation results invalidate query tags (`EventType`, `Booking`, `Schedule`, `Slots`) so the relevant lists auto-refetch without manual orchestration.
- **A small UI slice** (`lib/slices/uiSlice.ts`) for transient prefs (sidebar collapsed, 12h/24h). Real Redux state — not just RTK Query cache — so the slice pattern is in the codebase.
- **Server components (RSCs) still use `lib/api.ts`** because hooks aren't available there. The two paths coexist: RSCs handle non-interactive routes (booking detail, reschedule picker), client components use hooks (event-types list, bookings list, public picker).

**Trade-off:** RTK Query adds ~30 KB to the bundle (event-types page first-load went from 186 B → 11.9 kB after the migration). For a real cal.com clone the cache + invalidation + de-duped fetches earn that back many times over. For this single-user assignment it's mild over-engineering, but it's a fair reflection of how production schedulers actually structure their data layer.

**Why not React Query (TanStack):** RTK Query bundles the store + cache + middleware in one library, which keeps the dependency footprint smaller for an app that already wants a Redux slice. Both would have been defensible.

---

## 7b. Validation: one Zod, two places

- **Server-side**: every `validateBody()` middleware parses the request body through the shared `CreateBookingSchema` / `UpdateEventTypeSchema` / etc. from `packages/shared/src/schemas.ts`. Failures return a structured 400 with field paths.
- **Client-side**: the booking form runs the **same schema** via `CreateBookingSchema.safeParse(payload)` before calling the mutation. On failure, errors are mapped to per-field state and rendered inline. No wasted server round-trips for plainly-invalid input.

Single source of truth — if the schema gains a `phone` field tomorrow, both sides pick it up from one edit.

---

## 7c. Drag-to-reorder event types

`EventType.position Int @default(0)` plus a dedicated `POST /event-types/reorder` route that accepts `{ ids: string[] }` and applies them in a transaction. The client uses native HTML5 drag-and-drop (no `dnd-kit` dependency — too heavy for a single list). Optimistic UI: the parent owns an `overrideOrder` state that mirrors the dragged sequence; on `dragend` it diffs against the pre-drag snapshot and only POSTs if order actually changed. On API failure the previous order is restored and a toast fires.

**Why a separate route, not PATCH on each row:** a single transaction guarantees the list is consistent. N PATCH calls would let partial failures leave bookings half-reordered.

---

## 7d. Booking guests + email fan-out

`Booking.guests String[]` stores additional attendee emails. On `createBooking()` the array is normalised via `dedupedGuests()` (trim, lowercase-dedup, exclude the primary attendee email to avoid self-CC). On every booking lifecycle event (created / cancelled / rescheduled) the `notifications` service sends one EmailJS template per recipient — attendee, host, *each guest* — instead of relying on BCC headers (EmailJS REST doesn't support BCC). Sends run in `Promise.all` then `fireAndForget` so a failing notification can never abort the booking write.

**Trade-off:** EmailJS limits free tier to 200 emails / month. For a real product you'd swap to Postmark/Resend with a single send that includes BCC. The interface (`sendTemplate(params)`) is intentionally narrow so the swap is a one-file change.

---

## 7e. Reschedule chains

When a booking is rescheduled, the old row goes to `status = RESCHEDULED` (audit trail) and a new CONFIRMED row is created, linked via `Booking.rescheduledToId` (unique). The new row also carries a `rescheduleReason` and inherits the original `guests`.

This creates **chains** when a booking gets rescheduled multiple times (`A → B → C`). The UI surfaces them per cal.com:
- The terminal CONFIRMED booking shows in **Upcoming** with a "Rescheduled" badge.
- Every RESCHEDULED ancestor shows in **Cancelled** with the same badge.
- **Exception:** if the terminal becomes CANCELLED later, all RESCHEDULED ancestors are hidden — only the cancelled tail shows, because a dead chain shouldn't render N+1 cards.

The flag lives on the API response as `wasRescheduled: boolean`. The list route walks the chain with a depth-bounded loop (32 hops, defensive against cycles) to compute the terminal status and decide whether to include each ancestor.

---

## 8. Scope: what makes it in for 2 days

**Day 1** (backend + admin):
- Monorepo init (npm workspaces), shared package, both apps scaffolded, `concurrently` dev script.
- Express app with CORS, error middleware, zod validation middleware.
- Prisma + Neon Postgres, schema, migrations, seed script.
- API routes: event-types CRUD, schedules CRUD (incl. rules + overrides), bookings list/cancel.
- `availability.ts` service + `booking.ts` service.
- Web: admin shell (sidebar, layout, Inter font, shadcn setup), `lib/api.ts` typed client.
- Web admin pages: Event Types list/edit, Availability editor, Bookings dashboard.

**Day 2** (public flow + polish + deploy):
- `GET /slots` + `GET /public/:username/:slug` endpoints.
- Public booking page (three-pane), date picker w/ availability dots, time slots, form, confirmation.
- Transactional `createBooking()` with conflict check, `POST /bookings` wired to the form.
- Reschedule flow (cancel + create under the hood).
- README with schema diagram + setup + assumptions + both deploy URLs, responsive tweaks, deploy to Vercel + Render + Neon.

**Bonus features included** (user-confirmed): multiple availability schedules, date overrides, reschedule flow with reasons, multi-step reschedule chains, drag-to-reorder event types, guest emails, booking-lifecycle email notifications via EmailJS, dino game on 404. Buffer time stays in the schema and is honored by `getAvailableSlots()` but doesn't get its own UI tab.
**Bonus features skipped**: custom booking questions (extra schema + dynamic form), responsive mobile polish kept to "doesn't break" not "pixel-perfect", real video conferencing (location renders as "Cal Video" but no link is generated).

---

## 9. Deployment

- **Self-hosted on a Vultr VPS** at `cal.lakshyasharma.me` (frontend) and `api.lakshyasharma.me` (backend). One VM runs both apps under `pm2` (`cal-web` and `cal-api`); **nginx** terminates TLS (Let's Encrypt via Certbot, auto-renewing) and reverse-proxies each subdomain to the matching pm2 process on `localhost`.
- **No cold starts.** The original plan targeted Vercel (frontend) + Render free tier (backend) + Neon (DB) — the Render free tier sleeps after 15 min, so the first request took ~30s. Moving both apps onto Vultr eliminated that latency entirely; the API is always warm.
- **Database → Neon Postgres** (unchanged). `DATABASE_URL` is the pooled connection (used at runtime), `DIRECT_URL` is the direct connection (used by `prisma migrate`).
- **Deploy script** (`~/deploy.sh` on the server) does `git pull && npm install && npx prisma migrate deploy && npm run build && pm2 restart cal-api && cd ../web && npm install && npm run build && pm2 restart cal-web`. From the laptop, `./deploy.ps1` pushes + SSHes + runs it.
- **First deploy**: ran `npm run seed -w apps/api` once against Neon to populate the demo user, three sample schedules, four event types, and a couple of bookings.
- **CORS**: `WEB_ORIGIN=https://cal.lakshyasharma.me` on the API (`apps/api/.env`); the API responds with `Access-Control-Allow-Origin` only for that origin.
- **EmailJS**: `EMAILJS_SERVICE_ID/TEMPLATE_ID/PUBLIC_KEY/PRIVATE_KEY` env vars on the API; if any is missing the notifications service no-ops silently so bookings still work without email setup.
- **DNS layout**: `cal` → frontend, `api` → backend (both A records → `139.84.222.82`). Root `lakshyasharma.me` 301-redirects to `cal.lakshyasharma.me`.
- Submission lists the **single live URL** `https://cal.lakshyasharma.me`; `https://api.lakshyasharma.me/health` is documented in the README for grading-time backend verification.

---

## 10. Verification plan

Manual end-to-end checks before submission:
1. Seed runs cleanly on a fresh DB.
2. Create/edit/delete an event type from the dashboard.
3. Open availability page, edit Tue range, save, reload — change persists.
4. From an incognito tab, open `/<username>/<slug>`, pick a date that has availability, see slots, book, see confirmation, get redirected to success page.
5. Try to book the same slot a second time → blocked with a clear error.
6. Booking shows in admin "Upcoming"; cancel it → moves to "Cancelled" tab and slot becomes bookable again.
7. Change timezone in availability → public page slot times shift correctly.
8. Resize browser to mobile width → sidebar collapses, booking page stacks vertically.
9. Lighthouse pass on deployed URL: no major a11y or perf regressions.

---

## Critical files to create (reference for implementation phase)

**Backend (apps/api/):**
- `prisma/schema.prisma` — schema in §3
- `prisma/seed.ts` — default user + sample schedules + 3 event types + 2-3 bookings
- `src/services/availability.ts` — `getAvailableSlots()` per §4
- `src/services/booking.ts` — transactional `createBooking()` per §5
- `src/lib/time.ts` — `date-fns-tz` wrappers
- `src/index.ts` — Express app, CORS, routers, error middleware

**Frontend (apps/web/):**
- `app/(admin)/layout.tsx` — sidebar shell
- `app/[username]/[eventSlug]/page.tsx` — public booking three-pane
- `lib/api.ts` — typed fetch wrapper (server + client)

**Shared (packages/shared/):**
- `src/schemas.ts` — zod schemas for all request/response shapes
- `src/types.ts` — TS types inferred from zod

**Root:**
- `README.md` — setup, stack, schema diagram (Mermaid), assumptions, both deploy URLs, "how to run locally" with `npm install && npm run dev`
