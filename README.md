# Cal Clone — Scheduling Platform

A working clone of [cal.com](https://cal.com) built for the SDE Intern Fullstack assignment.
Lets a single host manage event types, configure availability schedules (with date
overrides), share a public booking link, and view/cancel/reschedule bookings.

---

## Tech stack

- **Frontend** — Next.js 14 (App Router) + Tailwind CSS + shadcn-style UI primitives + `date-fns-tz`.
- **Backend** — Express + TypeScript, deployed independently from the frontend.
- **Database** — PostgreSQL, accessed via Prisma.
- **Shared** — A `packages/shared` workspace with Zod schemas + inferred TypeScript types
  shared between web and API, so request/response shapes can't drift.

The repo is an **npm workspaces** monorepo:

```
cal/
├── apps/
│   ├── api/          # Express + Prisma
│   └── web/          # Next.js 14
└── packages/
    └── shared/       # Zod schemas + types
```

---

## Architecture & schema

Full architecture write-up (with trade-offs) is in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Schema overview** (see `apps/api/prisma/schema.prisma`):

```mermaid
erDiagram
    User ||--o{ EventType : owns
    User ||--o{ Schedule  : owns
    Schedule ||--o{ AvailabilityRule : has
    Schedule ||--o{ DateOverride     : has
    Schedule ||--o{ EventType        : referenced_by
    EventType ||--o{ Booking         : has

    User {
        string id PK
        string username UK
        string email UK
        string timezoneDefault
    }
    EventType {
        string id PK
        string userId FK
        string slug
        int    durationMinutes
        int    bufferBefore
        int    bufferAfter
        bool   isActive
    }
    Schedule {
        string id PK
        string timezone
        bool   isDefault
    }
    AvailabilityRule {
        int weekday "0=Sun..6=Sat"
        int startMinute "0..1440 in schedule tz"
        int endMinute
    }
    DateOverride {
        date date
        int  startMinute "nullable"
        int  endMinute   "nullable"
    }
    Booking {
        timestamptz startTime "UTC"
        timestamptz endTime   "UTC"
        enum status "CONFIRMED|CANCELLED|RESCHEDULED"
    }
```

Why these choices (short version):

- **Minutes-of-day + timezone-on-schedule** instead of `TIME` columns dodges DST and tz
  bugs entirely. The schedule is the source of truth for tz; bookings are stored UTC.
- **Multiple `AvailabilityRule` rows per (schedule, weekday)** lets a day have several
  time ranges (e.g. 9-12, 13-17) without JSON parsing — same model as Cal.com's UI.
- **Soft-cancel** (`status=CANCELLED` + `cancelledAt`) keeps the row for the "Cancelled"
  tab and the slot becomes re-bookable immediately.
- **No DB-level exclusion constraint for overlap.** Instead, `createBooking()` re-checks
  inside a `SERIALIZABLE` transaction — same correctness on the happy path, but no
  `btree_gist` extension dependency.

---

## Running locally

### Prerequisites

- Node.js ≥ 20
- A running PostgreSQL database — see the "Database" section below.

### 1. Install

```bash
npm install
```

This installs all three workspaces in one shot (`apps/api`, `apps/web`, `packages/shared`).

### 2. Configure environment

Copy `.env.example` in both apps:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env` and point `DATABASE_URL` / `DIRECT_URL` at your Postgres.

Defaults in `apps/web/.env.example` (`NEXT_PUBLIC_API_URL=http://localhost:4000`) work
out of the box for local dev.

### 3. Migrate + seed

```bash
npm run db:migrate            # creates the schema
npm run seed                  # creates the demo user + 3 event types + 2 bookings
```

### 4. Run

```bash
npm run dev                   # runs api on :4000 and web on :3000 concurrently
```

Then open:

- `http://localhost:3000/event-types` — admin dashboard
- `http://localhost:3000/lakshya/30min` — public booking page for the seeded user

---

## Database

Any Postgres works. Two recommended options:

**Neon** (used for deployment):

```bash
DATABASE_URL="postgresql://USER:PASS@HOST/db?sslmode=require&pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://USER:PASS@HOST/db?sslmode=require"
```

**Local Docker**:

```bash
docker run --name cal-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
# Then in apps/api/.env:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/postgres"
```

---

## Deployment

**Frontend → Vercel.**

- Root directory: `apps/web`
- Build command: `npm install --workspaces && npm run build -w apps/web`
- Output: default
- Env vars: `NEXT_PUBLIC_API_URL=<your-render-url>`

**Backend → Render** (Web Service, free tier).

- Root directory: repo root (it needs to see the workspaces).
- Build command: `npm install && npm run build -w apps/api`
- Start command: `npm run start -w apps/api`
- Env vars: `DATABASE_URL`, `DIRECT_URL`, `WEB_ORIGIN=<your-vercel-url>`, `PORT=10000`.
- After the first deploy, run `npm run seed -w apps/api` from the Render shell to populate
  the demo data.

**Database → Neon.**

> **Cold start note:** Render free tier sleeps after 15 minutes of inactivity, so the first
> request after the API has been idle can take ~30s to respond.

---

## Features

### Core (all implemented)

- **Event Types** — create / edit / delete / toggle active, each with a unique slug-based
  public URL, configurable duration, description, buffer time, and chosen availability
  schedule.
- **Availability** — weekly recurring rules (multiple ranges per day, copy-to-all-days),
  per-day timezone, date overrides (block a date or set different hours).
- **Public booking** — three-pane Cal.com-style layout (host info / month calendar /
  scrollable time slots), date picker dots availability, click-to-confirm slot
  interaction, 12h/24h toggle, viewer-timezone slot rendering.
- **Conflict prevention** — `createBooking()` runs in a SERIALIZABLE transaction that
  re-checks for overlap before insert; concurrent attempts to grab the same slot fail
  with a clear 409.
- **Bookings dashboard** — Upcoming / Past / Cancelled tabs, grouped by date, with
  cancel and reschedule actions.

### Bonus (included)

- **Multiple availability schedules** — first-class. The schema, the admin UI, and the
  event-type form all expect it.
- **Date overrides** — block a specific date or override hours for one day.
- **Reschedule flow** — `/reschedule/[bookingId]` reuses the same picker; the operation
  is a transactional cancel-old + create-new.

### Intentionally skipped (scope choice)

- Email notifications (would need SMTP / Resend setup).
- Custom booking questions (needs an extra question/answer table + dynamic form).
- Polished mobile responsiveness — the app stacks and works on mobile but isn't pixel-perfect.

---

## Assumptions

1. **No authentication.** A single "default" user is created by the seed script, and every
   admin route resolves the current user via `getCurrentUser()` (the first user by
   `createdAt`). The public booking page is fully unauthenticated.
2. **Timezones.** Availability is expressed in the schedule's timezone; bookings are
   stored UTC; the public page reads `?tz=` if present and otherwise falls back to the
   schedule's timezone (a real implementation would auto-detect via the browser).
3. **Slot grid.** Slots are aligned to `min(durationMinutes, 15)`-minute boundaries —
   matching what Cal.com does — rather than starting at arbitrary minutes.
4. **No real video conferencing.** "Cal Video" appears as the location on the booking
   page but no link is generated.
5. **Soft delete for cancellations.** Cancelled bookings remain queryable in the
   "Cancelled" tab; the slot becomes immediately re-bookable.

---

## API reference

| Method | Path | Description |
|---|---|---|
| GET    | `/health` | Liveness check |
| GET    | `/me` | Returns the (single seeded) user |
| GET    | `/event-types` | List the current user's event types |
| POST   | `/event-types` | Create |
| GET    | `/event-types/:id` | Get one |
| PATCH  | `/event-types/:id` | Update |
| DELETE | `/event-types/:id` | Delete |
| GET    | `/schedules` | List schedules + their rules + overrides |
| POST   | `/schedules` | Create (with rules + overrides) |
| GET    | `/schedules/:id` | Get one |
| PATCH  | `/schedules/:id` | Update (replaces rules/overrides if sent) |
| DELETE | `/schedules/:id` | Delete |
| GET    | `/bookings?scope=upcoming\|past\|cancelled` | List bookings |
| GET    | `/bookings/:id` | Get one (includes the host + event type) |
| POST   | `/bookings` | Create (transactional conflict check) |
| POST   | `/bookings/:id/cancel` | Soft-cancel |
| POST   | `/bookings/:id/reschedule` | Reschedule (cancel + create) |
| GET    | `/slots?eventTypeId&from&to&timezone` | Available slots, grouped by date |
| GET    | `/public/:username/:slug` | Public profile data for the booking page |

All request bodies are validated via Zod (schemas in `packages/shared/src/schemas.ts`).

---

## Project layout

```
apps/api/
  src/
    index.ts                       # Express app, CORS, error middleware
    db.ts                          # Prisma singleton
    routes/                        # thin HTTP handlers
    services/availability.ts       # getAvailableSlots() — core algorithm
    services/booking.ts            # transactional create/cancel/reschedule
    lib/{time,errors,currentUser}  # helpers
    middleware/{validate,errorHandler}
  prisma/
    schema.prisma
    seed.ts

apps/web/
  app/
    (admin)/                       # admin pages (sidebar layout)
      event-types/{page,new,[id]}
      availability/{page,new,[id]}
      bookings/page
    [username]/[eventSlug]/        # public booking
      page.tsx                     # calendar + slots
      book/page.tsx                # form
    booking/[id]/page.tsx          # confirmation
    reschedule/[id]/page.tsx
  components/
    ui/                            # button, input, calendar, etc.
    admin/                         # sidebar, event-type-card, schedule-editor
    booking/                       # event-info, booking-picker, booking-form
    shared/timezone-picker.tsx
  lib/api.ts                       # typed fetch wrapper

packages/shared/
  src/schemas.ts                   # Zod schemas
  src/types.ts                     # inferred TS types + API DTOs
```
