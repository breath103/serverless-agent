import type { ChatSessionMessageData, RealtimeEvent } from "@backend/lib/realtime-events";

import { api } from "@/lib/api";
import { createRealtimeContext } from "@/lib/realtime/context";

export type { ChatSessionMessageData, RealtimeEvent };

export const { Provider: RealtimeProvider, useRealtime } =
  createRealtimeContext<RealtimeEvent>({
    getConnection: () => api.fetch("/api/realtime/connection", "GET"),
  });
