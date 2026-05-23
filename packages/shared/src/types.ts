import type { z } from "zod";
import type {
  CreateBookingSchema,
  CreateEventTypeSchema,
  CreateScheduleSchema,
  UpdateEventTypeSchema,
  UpdateScheduleSchema,
  CancelBookingSchema,
  RescheduleBookingSchema,
  SlotsQuerySchema,
} from "./schemas";

export type CreateEventTypeInput = z.infer<typeof CreateEventTypeSchema>;
export type UpdateEventTypeInput = z.infer<typeof UpdateEventTypeSchema>;

export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof UpdateScheduleSchema>;

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
export type CancelBookingInput = z.infer<typeof CancelBookingSchema>;
export type RescheduleBookingInput = z.infer<typeof RescheduleBookingSchema>;

export type SlotsQuery = z.infer<typeof SlotsQuerySchema>;

// ---------- API response DTOs ----------

export type ApiError = {
  error: string;
  details?: unknown;
};

export type EventTypeDTO = {
  id: string;
  userId: string;
  title: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  scheduleId: string;
  bufferBefore: number;
  bufferAfter: number;
  hidden: boolean;
  position: number;
  createdAt: string;
};

export type AvailabilityRuleDTO = {
  id: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
};

export type DateOverrideDTO = {
  id: string;
  date: string; // YYYY-MM-DD
  startMinute: number | null;
  endMinute: number | null;
};

export type ScheduleDTO = {
  id: string;
  userId: string;
  name: string;
  timezone: string;
  isDefault: boolean;
  rules: AvailabilityRuleDTO[];
  overrides: DateOverrideDTO[];
};

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "RESCHEDULED";

export type BookingDTO = {
  id: string;
  eventTypeId: string;
  eventType?: Pick<EventTypeDTO, "id" | "title" | "slug" | "durationMinutes">;
  attendeeName: string;
  attendeeEmail: string;
  attendeeNotes: string | null;
  attendeeTimezone: string;
  guests: string[];
  startTime: string; // ISO UTC
  endTime: string; // ISO UTC
  status: BookingStatus;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  rescheduleReason: string | null;
  rescheduledToId: string | null;
  rescheduledFromId?: string | null;
  wasRescheduled?: boolean;
};

export type PublicProfileDTO = {
  user: {
    name: string;
    username: string;
    timezoneDefault: string;
  };
  eventType: EventTypeDTO;
  scheduleTimezone: string;
};

export type PublicUserDTO = {
  user: {
    name: string;
    username: string;
    timezoneDefault: string;
  };
  eventTypes: Array<
    Pick<EventTypeDTO, "id" | "title" | "slug" | "description" | "durationMinutes">
  >;
};

export type SlotsResponse = {
  // Map of "YYYY-MM-DD" (in viewer timezone) -> ISO UTC start strings
  slotsByDate: Record<string, string[]>;
};
