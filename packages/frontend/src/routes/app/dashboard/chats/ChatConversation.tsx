import { useEffect, useMemo, useRef } from "react";

import { useNavigate } from "@tanstack/react-router";

import type { ChatSessionMessageData } from "@/contexts/RealtimeContext";
import { useMutation } from "@/hooks/useMutation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import styles from "./ChatConversation.module.css";
import { ChatInput } from "./ChatInput";
import { useChatMessages } from "./hooks";
import { MessageBlock } from "./MessageBlock";

type AssistantContent = Extract<ChatSessionMessageData, { role: "assistant" }>["content"];
type ToolResult = Extract<AssistantContent, { kind: "tool_result" }>;

/** Existing chat: load from backend, append via /api/chat/:id/message. */
export function ChatConversation({ sessionId }: { sessionId: string }) {
  const { session, messages, loading } = useChatMessages(sessionId);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Auto-scroll to bottom only if the user is already near the bottom.
  // If they've scrolled up to read, don't yank them back down.
  const stickToBottomRef = useRef(true);

  const send = useMutation(async (text: string) => {
    await api.fetch("/api/chat/:id/message", "POST", {
      params: { id: sessionId },
      body: { message: text },
    });
  }, [sessionId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distance < 64;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, session?.is_generating]);

  const busy = send.status === "loading" || session?.is_generating === true;

  // Reverse index: tool_call_id → tool_result. Lets each tool_call block
  // render its matching result without a second linear pass per row.
  const resultByCallId = useMemo(() => {
    const map = new Map<string, ToolResult>();
    for (const m of messages) {
      if (m.data.role === "assistant" && m.data.content.kind === "tool_result") {
        map.set(m.data.content.tool_call_id, m.data.content);
      }
    }
    return map;
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <div className="hud-subheader justify-between gap-4 px-8">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 hud-eyebrow">SESSION //</span>
          <span className="truncate hud-label">
            {(session?.title ?? (loading ? "LOADING…" : "UNTITLED CHAT")).toUpperCase()}
          </span>
        </div>
        <span className="shrink-0 hud-label">MSGS [{messages.length}]</span>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-8">
          {messages.map((m, i) => {
            const prev = i > 0 ? messages[i - 1] : null;
            const showAuthor = m.data.role === "assistant" && prev?.data.role !== "assistant";
            const toolResult = m.data.role === "assistant" && m.data.content.kind === "tool_call"
              ? resultByCallId.get(m.data.content.tool_call_id)
              : undefined;
            return <MessageBlock key={m.id} message={m} showAuthor={showAuthor} toolResult={toolResult} />;
          })}
          {session?.is_generating && <ThinkingIndicator />}
        </div>
      </div>
      <ChatInput onSend={(text) => void send.call(text)} disabled={busy} />
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex animate-in items-center gap-3 py-3 duration-300 ease-out fade-in">
      <div className="flex items-end gap-1">
        <Dot delay="0ms" />
        <Dot delay="200ms" />
        <Dot delay="400ms" />
      </div>
      <span
        className="text-mint"
        style={{ fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase" }}
      >
        AGENT THINKING…
      </span>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className={cn(styles.breathe, "block size-1.5 bg-mint")}
      style={{ animationDelay: delay }}
    />
  );
}

/** Empty-state right pane: first send creates a new chat and navigates. */
export function NewChatConversation() {
  const navigate = useNavigate();

  const create = useMutation(async (text: string) => {
    const { sessionId } = await api.fetch("/api/chat", "POST", { body: { message: text } });
    await navigate({ to: "/dashboard/chats/$chatId", params: { chatId: sessionId } });
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="hud-subheader gap-2 px-8">
        <span className="shrink-0 hud-eyebrow">SESSION //</span>
        <span className="hud-label">NEW</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
        <p className="hud-label">AWAITING INPUT</p>
        <p className="hud-caption">TYPE BELOW TO INITIALIZE A NEW CHAT.</p>
      </div>
      <ChatInput onSend={(text) => void create.call(text)} disabled={create.status === "loading"} />
    </div>
  );
}
