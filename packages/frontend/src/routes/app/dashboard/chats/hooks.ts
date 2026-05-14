import { useCallback } from "react";

import { useRepositoryListQuery, useRepositoryQuery } from "@/contexts/RepositoryContext";
import { api } from "@/lib/api";

/** One session + its messages. Each query seeds from its own endpoint
 *  then stays live via the repository's entity_update stream. */
export function useChatMessages(sessionId: string) {
  const sessionQuery = useRepositoryQuery(
    "chat_sessions",
    { id: sessionId },
    useCallback(
      async () => api.fetch("/api/chat/:id", "GET", { params: { id: sessionId } }),
      [sessionId],
    ),
  );

  const messagesQuery = useRepositoryListQuery(
    "chat_session_messages",
    sessionId,
    {
      filter: (m) => m.session_id === sessionId,
      order: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    useCallback(
      async () => api.fetch("/api/chat/:id/messages", "GET", { params: { id: sessionId } }),
      [sessionId],
    ),
  );

  const loading =
    (sessionQuery.status === "fetching" && !sessionQuery.entity) ||
    (messagesQuery.status === "fetching" && messagesQuery.records.length === 0);

  return {
    session: sessionQuery.entity ?? null,
    messages: messagesQuery.records,
    loading,
  };
}
