import { HoverCard } from "radix-ui";
import { useCallback, useRef, useState } from "react";

import { ArrowUpIcon, LightbulbIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { useRequiredAuth } from "@/contexts/AuthContext";
import { useRepositoryQuery } from "@/contexts/RepositoryContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_HEIGHT = 200;

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useRequiredAuth();
  const { entity: profile } = useRepositoryQuery(
    "profiles",
    { user_id: user.id },
    useCallback(async () => await api.fetch("/api/user/profile", "GET"), []),
  );
  const suggestions = profile?.debug?.chat_suggestions ?? [];

  const canSend = value.trim().length > 0 && !disabled;

  const autosize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  const send = (text: string) => {
    if (disabled || text.trim().length === 0) return;
    onSend(text.trim());
    setValue("");
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = "auto";
        el.focus();
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(value);
    }
  };

  return (
    <div className="shrink-0 border-t border-cream-hair bg-background px-6 py-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <div
          className={cn(
            "flex min-h-11 flex-1 items-center border border-cream-hair bg-background",
            "transition-colors duration-150",
            "focus-within:border-cyan",
          )}
        >
          {suggestions.length > 0 && (
            <SuggestionsButton
              suggestions={suggestions}
              disabled={disabled}
              onPick={(text) => send(text)}
            />
          )}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autosize();
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder=">_ TYPE A MESSAGE..."
            className={cn(
              "w-full resize-none bg-transparent px-4 py-2.5 text-cream",
              "outline-none placeholder:text-cream-dim",
            )}
            style={{ fontSize: "0.8125rem", letterSpacing: "0.02em" }}
          />
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => send(value)}
          disabled={!canSend}
          aria-label="Send"
          className="size-11 shrink-0 p-0"
        >
          <ArrowUpIcon size={16} weight="bold" />
        </Button>
      </div>
    </div>
  );
}

function SuggestionsButton({
  suggestions,
  disabled,
  onPick,
}: {
  suggestions: string[];
  disabled?: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <HoverCard.Root openDelay={80} closeDelay={120}>
      <HoverCard.Trigger asChild>
        <button
          type="button"
          aria-label="Suggested prompts"
          className={cn(
            "ml-2 flex size-8 shrink-0 items-center justify-center",
            "text-cream-dim transition-colors duration-100",
            "hover:text-cyan",
          )}
        >
          <LightbulbIcon size={15} weight="fill" />
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="start"
          sideOffset={10}
          className={cn(
            "z-50 w-96 border border-cream-hair bg-background p-0 bloom-edge",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
        >
          <div className="border-b border-cream-hair px-3 py-2 hud-label">
            SUGGESTED PROMPTS
          </div>
          <ul className="flex flex-col">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(s)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-cream",
                    "transition-colors duration-100",
                    "hover:bg-cream/10 active:bg-cream/15",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  style={{ fontSize: "0.75rem", letterSpacing: "0.02em" }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
