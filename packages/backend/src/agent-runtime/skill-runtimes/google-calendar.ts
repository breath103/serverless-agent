import { z } from "zod";

import { defineSkillRuntime } from "./define.js";

const CalendarSummary = z.object({
  id: z.string(),
  name: z.string(),
  primary: z.boolean().optional(),
  accessRole: z.string(),
});

const CalendarEvent = z.object({
  id: z.string(),
  title: z.string().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  description: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string()).optional(),
});

const BASE = "https://www.googleapis.com/calendar/v3";

interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string }[];
}

const mapEvent = (e: GCalEvent): z.infer<typeof CalendarEvent> => ({
  id: e.id,
  title: e.summary ?? null,
  start: e.start?.dateTime ?? e.start?.date ?? null,
  end: e.end?.dateTime ?? e.end?.date ?? null,
  description: e.description,
  location: e.location,
  attendees: e.attendees?.map((a) => a.email),
});

export const googleCalendar = defineSkillRuntime("google-calendar", {
  instanceDescription: (config) => `${config.name} — ${config.email}`,
  create: (instanceId, config) => ({
    async apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
      const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Google Calendar API ${res.status}: ${text}`);
      }
      if (res.status === 204) return undefined as T;
      return res.json() as Promise<T>;
    },
  }),

  entities: { CalendarSummary, CalendarEvent },

  methods: (m) => ({
    listCalendars: m({
      returns: z.array(CalendarSummary),
      handler: async (ctx) => {
        const data = await ctx.apiFetch<{ items?: { id: string; summary?: string; primary?: boolean; accessRole?: string }[] }>(
          "/users/me/calendarList",
        );
        return (data.items ?? []).map((c) => ({
          id: c.id,
          name: c.summary ?? "(unnamed)",
          primary: c.primary,
          accessRole: c.accessRole ?? "reader",
        }));
      },
    }),

    listEvents: m({
      params: z.object({
        from: z.string(),
        to: z.string(),
        calendarId: z.string().optional(),
      }),
      returns: z.array(CalendarEvent),
      handler: async (ctx, params) => {
        const cal = params.calendarId ?? "primary";
        const qs = new URLSearchParams({
          timeMin: new Date(params.from).toISOString(),
          timeMax: new Date(params.to).toISOString(),
          singleEvents: "true",
          orderBy: "startTime",
        });
        const data = await ctx.apiFetch<{ items?: GCalEvent[] }>(`/calendars/${cal}/events?${qs}`);
        return (data.items ?? []).map(mapEvent);
      },
    }),

    createEvent: m({
      params: z.object({
        title: z.string(),
        start: z.string(),
        end: z.string(),
        description: z.string().optional(),
        location: z.string().optional(),
        attendees: z.array(z.string()).optional(),
        calendarId: z.string().optional(),
      }),
      returns: CalendarEvent,
      handler: async (ctx, params) => {
        const cal = params.calendarId ?? "primary";
        const data = await ctx.apiFetch<GCalEvent>(`/calendars/${cal}/events`, {
          method: "POST",
          body: JSON.stringify({
            summary: params.title,
            start: { dateTime: new Date(params.start).toISOString() },
            end: { dateTime: new Date(params.end).toISOString() },
            description: params.description,
            location: params.location,
            attendees: params.attendees?.map((email) => ({ email })),
          }),
        });
        return mapEvent(data);
      },
    }),

    updateEvent: m({
      params: z.object({
        eventId: z.string(),
        title: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        attendees: z.array(z.string()).optional(),
        calendarId: z.string().optional(),
      }),
      returns: CalendarEvent,
      handler: async (ctx, params) => {
        const cal = params.calendarId ?? "primary";
        const data = await ctx.apiFetch<GCalEvent>(`/calendars/${cal}/events/${params.eventId}`, {
          method: "PATCH",
          body: JSON.stringify({
            summary: params.title,
            start: params.start ? { dateTime: new Date(params.start).toISOString() } : undefined,
            end: params.end ? { dateTime: new Date(params.end).toISOString() } : undefined,
            description: params.description,
            location: params.location,
            attendees: params.attendees?.map((email) => ({ email })),
          }),
        });
        return mapEvent(data);
      },
    }),

    deleteEvent: m({
      params: z.object({
        eventId: z.string(),
        calendarId: z.string().optional(),
      }),
      handler: async (ctx, params) => {
        const cal = params.calendarId ?? "primary";
        await ctx.apiFetch<void>(`/calendars/${cal}/events/${params.eventId}`, {
          method: "DELETE",
        });
      },
    }),
  }),
});
