import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
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

type Me = {
  id: string;
  name: string;
  email: string;
  username: string;
  timezoneDefault: string;
};

type BookingDetail = BookingDTO & {
  eventType: EventTypeDTO & { user: { name: string; username: string } };
  guests?: string[];
  rescheduledFrom?: {
    id: string;
    startTime: string;
    endTime: string;
    attendeeEmail: string;
  } | null;
};

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

export const calApi = createApi({
  reducerPath: "calApi",
  baseQuery: fetchBaseQuery({ baseUrl: getBaseUrl() }),
  tagTypes: ["Me", "EventType", "Schedule", "Booking", "Slots"],
  endpoints: (build) => ({
    getMe: build.query<Me, void>({
      query: () => "/me",
      providesTags: ["Me"],
    }),

    listEventTypes: build.query<EventTypeDTO[], void>({
      query: () => "/event-types",
      providesTags: (result) =>
        result
          ? [
              ...result.map((et) => ({ type: "EventType" as const, id: et.id })),
              { type: "EventType" as const, id: "LIST" },
            ]
          : [{ type: "EventType" as const, id: "LIST" }],
    }),
    getEventType: build.query<EventTypeDTO, string>({
      query: (id) => `/event-types/${id}`,
      providesTags: (_r, _e, id) => [{ type: "EventType", id }],
    }),
    createEventType: build.mutation<EventTypeDTO, CreateEventTypeInput>({
      query: (body) => ({ url: "/event-types", method: "POST", body }),
      invalidatesTags: [{ type: "EventType", id: "LIST" }],
    }),
    updateEventType: build.mutation<
      EventTypeDTO,
      { id: string; body: UpdateEventTypeInput }
    >({
      query: ({ id, body }) => ({
        url: `/event-types/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "EventType", id: arg.id },
        { type: "EventType", id: "LIST" },
      ],
    }),
    deleteEventType: build.mutation<void, string>({
      query: (id) => ({ url: `/event-types/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "EventType", id: "LIST" }],
    }),
    reorderEventTypes: build.mutation<void, string[]>({
      query: (ids) => ({
        url: "/event-types/reorder",
        method: "POST",
        body: { ids },
      }),
      invalidatesTags: [{ type: "EventType", id: "LIST" }],
    }),

    listSchedules: build.query<ScheduleDTO[], void>({
      query: () => "/schedules",
      providesTags: (result) =>
        result
          ? [
              ...result.map((s) => ({ type: "Schedule" as const, id: s.id })),
              { type: "Schedule" as const, id: "LIST" },
            ]
          : [{ type: "Schedule" as const, id: "LIST" }],
    }),
    getSchedule: build.query<ScheduleDTO, string>({
      query: (id) => `/schedules/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Schedule", id }],
    }),
    createSchedule: build.mutation<ScheduleDTO, CreateScheduleInput>({
      query: (body) => ({ url: "/schedules", method: "POST", body }),
      invalidatesTags: [{ type: "Schedule", id: "LIST" }],
    }),
    updateSchedule: build.mutation<
      ScheduleDTO,
      { id: string; body: UpdateScheduleInput }
    >({
      query: ({ id, body }) => ({
        url: `/schedules/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Schedule", id: arg.id },
        { type: "Schedule", id: "LIST" },
      ],
    }),
    deleteSchedule: build.mutation<void, string>({
      query: (id) => ({ url: `/schedules/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Schedule", id: "LIST" }],
    }),

    listBookings: build.query<BookingDTO[], "upcoming" | "past" | "cancelled">({
      query: (scope) => `/bookings?scope=${scope}`,
      providesTags: (result, _e, scope) =>
        result
          ? [
              ...result.map((b) => ({ type: "Booking" as const, id: b.id })),
              { type: "Booking" as const, id: `LIST-${scope}` },
            ]
          : [{ type: "Booking" as const, id: `LIST-${scope}` }],
    }),
    getBooking: build.query<BookingDetail, string>({
      query: (id) => `/bookings/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Booking", id }],
    }),
    createBooking: build.mutation<BookingDTO, CreateBookingInput>({
      query: (body) => ({ url: "/bookings", method: "POST", body }),
      invalidatesTags: [
        { type: "Booking", id: "LIST-upcoming" },
        { type: "Slots", id: "ALL" },
      ],
    }),
    cancelBooking: build.mutation<
      BookingDTO,
      { id: string; body: CancelBookingInput }
    >({
      query: ({ id, body }) => ({
        url: `/bookings/${id}/cancel`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Booking", id: arg.id },
        { type: "Booking", id: "LIST-upcoming" },
        { type: "Booking", id: "LIST-cancelled" },
        { type: "Slots", id: "ALL" },
      ],
    }),
    rescheduleBooking: build.mutation<
      BookingDTO,
      { id: string; body: RescheduleBookingInput }
    >({
      query: ({ id, body }) => ({
        url: `/bookings/${id}/reschedule`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Booking", id: arg.id },
        { type: "Booking", id: "LIST-upcoming" },
        { type: "Slots", id: "ALL" },
      ],
    }),

    getSlots: build.query<
      SlotsResponse,
      { eventTypeId: string; from: string; to: string; timezone?: string }
    >({
      query: (q) => {
        const params = new URLSearchParams({
          eventTypeId: q.eventTypeId,
          from: q.from,
          to: q.to,
        });
        if (q.timezone) params.set("timezone", q.timezone);
        return `/slots?${params.toString()}`;
      },
      providesTags: [{ type: "Slots", id: "ALL" }],
    }),

    getPublicProfile: build.query<
      PublicProfileDTO,
      { username: string; slug: string }
    >({
      query: ({ username, slug }) =>
        `/public/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`,
    }),
    getPublicUser: build.query<PublicUserDTO, string>({
      query: (username) => `/public/${encodeURIComponent(username)}`,
    }),
  }),
});

export const {
  useGetMeQuery,
  useListEventTypesQuery,
  useGetEventTypeQuery,
  useCreateEventTypeMutation,
  useUpdateEventTypeMutation,
  useDeleteEventTypeMutation,
  useReorderEventTypesMutation,
  useListSchedulesQuery,
  useGetScheduleQuery,
  useCreateScheduleMutation,
  useUpdateScheduleMutation,
  useDeleteScheduleMutation,
  useListBookingsQuery,
  useGetBookingQuery,
  useCreateBookingMutation,
  useCancelBookingMutation,
  useRescheduleBookingMutation,
  useGetSlotsQuery,
  useGetPublicProfileQuery,
  useGetPublicUserQuery,
} = calApi;
