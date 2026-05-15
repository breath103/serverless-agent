declare namespace GoogleCalendar {
  interface CalendarSummary {
    id: string;
    name: string;
    primary?: boolean;
    accessRole: string;
  }
  interface CalendarEvent {
    id: string;
    title: string | null;
    start: string | null;
    end: string | null;
    description?: string;
    location?: string;
    attendees?: string[];
  }
  interface Skill {
    listCalendars(): Promise<GoogleCalendar.CalendarSummary[]>;
    listEvents(params: {
      from: string;
      to: string;
      calendarId?: string;
    }): Promise<GoogleCalendar.CalendarEvent[]>;
    createEvent(params: {
      title: string;
      start: string;
      end: string;
      description?: string;
      location?: string;
      attendees?: string[];
      calendarId?: string;
    }): Promise<GoogleCalendar.CalendarEvent>;
    updateEvent(params: {
      eventId: string;
      title?: string;
      start?: string;
      end?: string;
      description?: string;
      location?: string;
      attendees?: string[];
      calendarId?: string;
    }): Promise<GoogleCalendar.CalendarEvent>;
    deleteEvent(params: {
      eventId: string;
      calendarId?: string;
    }): Promise<void>;
  }
}
