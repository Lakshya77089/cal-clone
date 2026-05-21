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
│   │   │   ├── index.ts            # express app, cors, mounts routers
│   │   │   ├── db.ts               # prisma client singleton
│   │   │   ├── routes/
│   │   │   │   ├── eventTypes.ts   # GET/POST/PATCH/DELETE /event-types
│   │   │   │   ├── schedules.ts    # /schedules (+ rules + overrides)
│   │   │   │   ├── bookings.ts     # /bookings (list, cancel, reschedule)
│   │   │   │   ├── slots.ts        # GET /slots?eventTypeId=...&from=...&to=...
│   │   │   │   └── public.ts       # GET /public/:username/:slug — booking page data
│   │   │   ├── services/
│   │   │   │   ├── availability.ts # getAvailableSlots() — the core algorithm
│   │   │   │   └── booking.ts      # createBooking()/cancelBooking() — transactional
│   │   │   ├── lib/
│   │   │   │   ├── time.ts         # date-fns-tz wrappers
│   │   │   │   └── errors.ts       # HttpError, error middleware
│   │   │   └── middleware/
│   │   │       └── validate.ts     # zod request body validator
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                        # Next.js 14 App Router frontend
│       ├── app/
│       │   ├── (admin)/            # grouped admin layout w/ sidebar
│       │   │   ├── event-types/{page, new/page, [id]/page}.tsx
│       │   │   ├── availability/{page, [id]/page}.tsx
│       │   │   └── bookings/page.tsx
│       │   ├── [username]/[eventSlug]/   # public booking, no auth
│       │   │   ├── page.tsx              # calendar + slots
│       │   │   ├── book/page.tsx         # form (after slot pick)
│       │   │   └── success/[bookingId]/page.tsx
│       │   └── layout.tsx
│       ├── components/
│       │   ├── ui/                 # shadcn generated
│       │   ├── admin/              # Sidebar, EventTypeCard, ScheduleEditor, BookingRow
│       │   ├── booking/            # CalendarPicker, TimeSlotList, BookingForm
│       │   └── shared/             # TimezonePicker, etc.
│       ├── lib/
│       │   ├── api.ts              # typed fetch wrapper (server + client safe)
│       │   └── constants.ts
│       ├── package.json
│       └── next.config.js
│
├── packages/
│   └── shared/                     # types + zod schemas shared between web & api
│       ├── src/
│       │   ├── schemas.ts          # zod for EventType, Booking, Schedule, etc.
│       │   └── types.ts            # exported TS types inferred from zod
│       └── package.json
│
├── package.json                    # workspaces root, "dev": concurrently both apps
├── pnpm-workspace.yaml             # or npm workspaces — see below
└── README.md
```

**Workspace tool trade-off:** pnpm vs npm workspaces. pnpm is faster and stricter, but the evaluator may not have it installed. **Use npm workspaces** — works out of the box with `npm install` at root, no extra prerequisite in setup instructions.

The boundary that matters: **Express route handlers stay thin and call `services/`.** Business logic (availability math, conflict checks) is testable in isolation without HTTP.

---

## 7. UI implementation strategy (per Cal.com research)

- shadcn components: `Button`, `Input`, `Textarea`, `Select`, `Switch`, `Tabs`, `Dialog`, `Sheet`, `Form`, `Calendar`, `DropdownMenu`, `Toast` (Sonner).
- Layout: light gray app bg (`bg-gray-50`), white content cards (`bg-white border border-gray-200 rounded-2xl shadow-sm`).
- Color: gray-900 primary, gray-50/100/200 surfaces, true white. No accent color (matches Cal's monochrome aesthetic).
- Font: Inter via `next/font/google`.
- Admin sidebar: `w-64` fixed, full-height, with icon+label nav. Active state `bg-gray-100`.
- Public booking page: three-pane card on `bg-gray-50` background, max-w-5xl centered, exactly mirroring Cal.com's signature layout.
- Date picker: shadcn `Calendar` (built on react-day-picker, which date-fns powers) — with custom `modifiers` to dot available dates and disable unavailable ones.
- Time slot "expand to confirm" interaction: stateful list where the clicked slot becomes a two-button row.

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

**Bonus features included** (user-confirmed): multiple availability schedules, date overrides, reschedule flow. Buffer time stays in the schema and is honored by `getAvailableSlots()` but won't get its own dedicated UI (configurable from the EventType "Limits" tab, matching Cal.com).
**Bonus features skipped**: email notifications (needs SMTP, time sink), custom booking questions (extra schema + UI), responsive mobile polish kept to "doesn't break" not "perfect".

---

## 9. Deployment

- **Frontend (apps/web) → Vercel.** Free, native Next.js host. Env var: `NEXT_PUBLIC_API_URL` (the public Render URL of the API) plus `INTERNAL_API_URL` (same value in this setup — they only diverge if API is on a private network, which Render free tier isn't).
- **Backend (apps/api) → Render Web Service.** Free tier, supports Node, persistent enough for the demo. Build cmd: `npm install && npm run build -w apps/api`; start cmd: `npm run start -w apps/api`. Env vars: `DATABASE_URL`, `DIRECT_URL`, `WEB_ORIGIN` (the Vercel URL, for CORS).
- **Database → Neon Postgres** (user-confirmed). `DATABASE_URL` is the pooled connection (used at runtime), `DIRECT_URL` is the direct connection (used by `prisma migrate`).
- **Trade-off — Render free tier cold starts (~30s on first request after inactivity).** Acceptable for an evaluator who will hit the URL and wait; documented in README. Alternative: deploy API to Railway (no cold starts but free tier is more limited time-wise). Render chosen for simpler "free forever" story during evaluation window.
- After first deploy: SSH into Render shell (or run locally pointed at production `DATABASE_URL`) → `npm run seed -w apps/api` once to populate the default user, sample schedules, sample event types, and a few bookings.
- Submission lists **two URLs**: the Vercel web URL (primary) and the Render API URL (so the evaluator can hit `GET /health` to verify the backend independently).

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
