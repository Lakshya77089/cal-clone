import type {
  BookingDTO,
  CancelBookingInput,
  CreateBookingInput,
  CreateEventTypeInput,
  CreateScheduleInput,
  EventTypeDTO,
  PublicProfileDTO,
  PublicUserDTO,
  RescheduleBookingInput,
  ScheduleDTO,
  SlotsResponse,
  UpdateEventTypeInput,
  UpdateScheduleInput,
} from "@cal/shared";

/**
 * Resolve the API base URL.
 *
 * On the server (RSCs, route handlers) prefer INTERNAL_API_URL — this lets
 * production deploys point at a private/internal address while the browser
 * uses the public one. Falls back to NEXT_PUBLIC_API_URL.
 */
function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return (
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:4000"
    );
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}

type FetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Pass `cache: "no-store"` to bypass Next.js fetch cache in RSCs. */
  cache?: RequestCache;
};

async function request<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache ?? "no-store",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------- Endpoints ----------

export const api = {
  me: () => request<{ id: string; name: string; email: string; username: string; timezoneDefault: string }>("/me"),

  eventTypes: {
    list: () => request<EventTypeDTO[]>("/event-types"),
    get: (id: string) => request<EventTypeDTO>(`/event-types/${id}`),
    create: (body: CreateEventTypeInput) =>
      request<EventTypeDTO>("/event-types", { method: "POST", body }),
    update: (id: string, body: UpdateEventTypeInput) =>
      request<EventTypeDTO>(`/event-types/${id}`, { method: "PATCH", body }),
    remove: (id: string) =>
      request<void>(`/event-types/${id}`, { method: "DELETE" }),
    reorder: (ids: string[]) =>
      request<void>("/event-types/reorder", { method: "POST", body: { ids } }),
  },

  schedules: {
    list: () => request<ScheduleDTO[]>("/schedules"),
    get: (id: string) => request<ScheduleDTO>(`/schedules/${id}`),
    create: (body: CreateScheduleInput) =>
      request<ScheduleDTO>("/schedules", { method: "POST", body }),
    update: (id: string, body: UpdateScheduleInput) =>
      request<ScheduleDTO>(`/schedules/${id}`, { method: "PATCH", body }),
    remove: (id: string) => request<void>(`/schedules/${id}`, { method: "DELETE" }),
  },

  bookings: {
    list: (scope: "upcoming" | "past" | "cancelled") =>
      request<BookingDTO[]>(`/bookings?scope=${scope}`),
    get: (id: string) => request<BookingDTO & { eventType: EventTypeDTO & { user: { name: string; username: string } } }>(`/bookings/${id}`),
    create: (body: CreateBookingInput) =>
      request<BookingDTO>("/bookings", { method: "POST", body }),
    cancel: (id: string, body: CancelBookingInput) =>
      request<BookingDTO>(`/bookings/${id}/cancel`, { method: "POST", body }),
    reschedule: (id: string, body: RescheduleBookingInput) =>
      request<BookingDTO>(`/bookings/${id}/reschedule`, { method: "POST", body }),
  },

  slots: (query: { eventTypeId: string; from: string; to: string; timezone?: string }) => {
    const params = new URLSearchParams({
      eventTypeId: query.eventTypeId,
      from: query.from,
      to: query.to,
    });
    if (query.timezone) params.set("timezone", query.timezone);
    return request<SlotsResponse>(`/slots?${params.toString()}`);
  },

  publicProfile: (username: string, slug: string) =>
    request<PublicProfileDTO>(`/public/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`),

  publicUser: (username: string) =>
    request<PublicUserDTO>(`/public/${encodeURIComponent(username)}`),
};
