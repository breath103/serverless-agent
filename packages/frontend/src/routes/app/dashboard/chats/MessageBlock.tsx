import { useState } from "react";

import type { SkillCall } from "@backend/agent-runtime/types";
import type { ChatSessionMessageRow } from "@backend/types/database";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { CaretRightIcon, CheckCircleIcon, CircleNotchIcon, CodeIcon, GlobeIcon, TreeStructureIcon, WarningCircleIcon } from "@phosphor-icons/react";

import { MarkdownBlock } from "@/components/MarkdownBlock";
import type { ChatSessionMessageData } from "@/contexts/RealtimeContext";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { ResourceRef } from "@/routes/app/dashboard/ResourceRow";
import { ResourceRow } from "@/routes/app/dashboard/ResourceRow";

type AssistantContent = Extract<ChatSessionMessageData, { role: "assistant" }>["content"];
type ToolCall = Extract<AssistantContent, { kind: "tool_call" }>;
type ToolResult = Extract<AssistantContent, { kind: "tool_result" }>;

export function MessageBlock({
  message,
  showAuthor,
  toolResult,
}: {
  message: ChatSessionMessageRow;
  showAuthor: boolean;
  /** For tool_call messages: the matching tool_result if it has arrived. */
  toolResult?: ToolResult;
}) {
  const { data } = message;
  if (data.role === "user") {
    return <UserBubble text={data.content.text} createdAt={message.created_at} />;
  }
  const content = data.content;
  if (content.kind === "tool_result") return null;
  return (
    <AssistantFrame showAuthor={showAuthor} createdAt={message.created_at}>
      {content.kind === "tool_call"
        ? <ToolCallBlock call={content} result={toolResult ?? null} />
        : <AssistantContentBody content={content} />}
    </AssistantFrame>
  );
}

function UserBubble({ text, createdAt }: { text: string; createdAt: string }) {
  return (
    <div className="flex animate-in justify-end py-2 duration-300 ease-out fade-in slide-in-from-bottom-1">
      <div className="flex max-w-[75%] flex-col items-end gap-1">
        <div
          className="border border-mint/40 bg-mint/8 px-3.5 py-2 whitespace-pre-wrap text-amber"
          style={{ fontSize: "0.8125rem", lineHeight: 1.55 }}
        >
          {text}
        </div>
        <time
          className="px-1 text-mint tabular-nums"
          style={{ fontSize: "0.625rem", letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          {relativeTime(new Date(createdAt))}
        </time>
      </div>
    </div>
  );
}

function AssistantFrame({
  showAuthor,
  createdAt,
  children,
}: {
  showAuthor: boolean;
  createdAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-in py-2 duration-300 ease-out fade-in slide-in-from-bottom-1">
      {showAuthor && (
        <div
          className="mb-1.5 flex items-center gap-2 text-mint"
          style={{ fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase" }}
        >
          <span className="animate-hud-blink" aria-hidden>▪</span>
          <span className="font-bold">AGENT</span>
          <span className="text-amber-hair">//</span>
          <time className="text-amber-dim tabular-nums">{relativeTime(new Date(createdAt))}</time>
        </div>
      )}
      {children}
    </div>
  );
}

function AssistantContentBody({ content }: { content: Exclude<AssistantContent, { kind: "tool_call" | "tool_result" }> }) {
  switch (content.kind) {
    case "text":
      return (
        <div className="text-amber" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
          <MarkdownBlock text={content.text} />
        </div>
      );
    case "error":
      return (
        <div className="flex items-center gap-2 border border-red bg-red/8 px-3 py-2 text-xs text-red">
          <WarningCircleIcon size={14} weight="fill" />
          <span>! {content.message}</span>
        </div>
      );
  }
}

function ToolCallBlock({ call, result }: { call: ToolCall; result: ToolResult | null }) {
  const [showCode, setShowCode] = useState(false);
  return (
    <div className="flex flex-col divide-y divide-amber-hair overflow-hidden border border-amber-dim">
      <div className="flex items-center gap-3 bg-amber/5 px-3 py-2 text-xs">
        <CodeIcon size={14} weight="regular" className="shrink-0 text-amber-dim" />
        <div
          className="min-w-0 flex-1 truncate text-amber"
          style={{ letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.6875rem", fontWeight: 600 }}
        >
          {call.input.description || "RUNNING CODE"}
        </div>
        <button
          type="button"
          onClick={() => setShowCode((x) => !x)}
          className="flex shrink-0 items-center gap-1 text-amber-dim hover:text-amber"
          style={{ fontSize: "0.625rem", letterSpacing: "0.08em", textTransform: "uppercase" }}
        >
          <span>{showCode ? "HIDE CODE" : "SHOW CODE"}</span>
          <CaretRightIcon
            size={10}
            weight="bold"
            className={cn("transition-transform duration-150", showCode && "rotate-90")}
          />
        </button>
      </div>

      {!result && <RunningRow />}
      {result?.error && <ErrorRow message={result.error} />}
      {result?.skillCalls.map((sc, i) => (
        <SkillCallRow key={i} call={sc} />
      ))}

      {showCode && (
        <pre className="overflow-auto bg-black p-3 font-mono text-mint" style={{ fontSize: "0.6875rem", lineHeight: 1.5 }}>
          <code>{call.input.code}</code>
        </pre>
      )}
    </div>
  );
}

function RunningRow() {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 text-mint"
      style={{ fontSize: "0.6875rem", letterSpacing: "0.08em", textTransform: "uppercase" }}
    >
      <CircleNotchIcon size={13} className="shrink-0 animate-hud-tick" />
      <span>EXECUTING…</span>
    </div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-red/8 px-3 py-2 text-xs text-red">
      <WarningCircleIcon size={14} weight="fill" className="mt-0.5 shrink-0" />
      <code className="min-w-0 flex-1 truncate text-[11px]">! {message}</code>
    </div>
  );
}

function SkillCallRow({ call }: { call: SkillCall }) {
  const { icon, label, summary } = describeSkillCall(call);
  const results = describeSkillCallResults(call);
  const hasDetails = results !== null && results.length > 0;
  const [expanded, setExpanded] = useState(true);
  const toggle = () => setExpanded((x) => !x);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={hasDetails ? toggle : undefined}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2 text-left",
          hasDetails ? "cursor-pointer hover:bg-amber/8" : "cursor-default",
        )}
        style={{ fontSize: "0.6875rem" }}
      >
        {hasDetails ? (
          <CaretRightIcon
            size={10}
            weight="bold"
            className={cn(
              "shrink-0 text-amber-dim transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
        ) : (
          <span className="w-[10px] shrink-0" />
        )}
        <SkillIconNode icon={icon} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="text-amber"
            style={{ letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}
          >
            {label}
          </span>
          {summary && (
            <>
              <span className="text-amber-hair">//</span>
              <span className="min-w-0 truncate text-amber-dim">{summary}</span>
            </>
          )}
        </div>
        <CheckCircleIcon size={14} weight="fill" className="shrink-0 text-mint" />
      </button>
      {hasDetails && expanded && (
        <div className="px-3 pb-2">
          <div className="ml-[30px] flex flex-col gap-0.5 border-l border-amber-hair pl-3">
            {results.map((r, i) => <ResultRow key={i} r={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillIconNode({ icon }: { icon: SkillIconRef }) {
  const Icon = icon;
  return <Icon size={13} weight="regular" className="shrink-0 text-amber-dim" />;
}

type SkillIconRef = PhosphorIcon;

/**
 * Per-(skill, method) display spec. Declared return type keeps the switches
 * exhaustive — adding a new method on any skill surfaces here as a TS error.
 */
function describeSkillCall(call: SkillCall): { icon: SkillIconRef; label: string; summary: string | null } {
  switch (call.skill) {
    case "memory":
      switch (call.method) {
        case "search": return { icon: TreeStructureIcon, label: "Searching memory", summary: call.params.query };
        case "get": return { icon: TreeStructureIcon, label: "Reading memories", summary: `${call.params.ids.length} items` };
        case "create": return { icon: TreeStructureIcon, label: "Creating memory", summary: call.params.title };
        case "update": return { icon: TreeStructureIcon, label: "Updating memory", summary: call.params.title ?? null };
      }
      break;

    case "web-search":
      switch (call.method) {
        case "search": return { icon: GlobeIcon, label: "Searching the web", summary: call.params.query };
        case "imageSearch": return { icon: GlobeIcon, label: "Searching images", summary: call.params.query };
      }
  }
  return { icon: CodeIcon, label: "Skill call", summary: null };
}

interface SkillCallResultRow {
  label: string;
  badge?: string;
  detail?: string;
  resource?: ResourceRef;
}

function ResultRow({ r }: { r: SkillCallResultRow }) {
  const body = (
    <>
      {r.badge && (
        <span className="shrink-0 border border-mint-dim px-1.5 py-px text-mint" style={{ fontSize: "0.5625rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {r.badge}
        </span>
      )}
      <span className="min-w-0 truncate text-amber">{r.label}</span>
      {r.detail && (
        <span className="min-w-0 truncate text-amber-dim">// {r.detail}</span>
      )}
    </>
  );
  const rowClass = "flex min-w-0 items-baseline gap-2 text-[11px]";
  if (r.resource) {
    return (
      <ResourceRow resource={r.resource} className={cn(rowClass, "-mx-1 cursor-pointer px-1 hover:bg-amber/10")}>
        {body}
      </ResourceRow>
    );
  }
  return <div className={rowClass}>{body}</div>;
}

function describeSkillCallResults(call: SkillCall): SkillCallResultRow[] | null {
  switch (call.skill) {
    case "memory":
      switch (call.method) {
        case "search": return call.output.map((m) => ({
          label: m.title,
          resource: { kind: "memory", id: m.id },
        }));
        case "get": return call.output.map((m) => ({
          label: m.title,
          resource: { kind: "memory", id: m.id },
        }));
        case "create":
        case "update":
          return null;
      }
      break;

    case "web-search":
      return null;
  }
  return null;
}
