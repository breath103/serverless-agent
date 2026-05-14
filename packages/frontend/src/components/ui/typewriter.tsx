import { useEffect, useRef } from "react";

type Props = {
  text: string;
  /** ms per character. Default 28 — fast enough to feel like a terminal print. */
  speed?: number;
  /** ms to wait before starting. Useful for staggering multiple titles. */
  delay?: number;
  /** Show a block cursor that's solid while typing then blinks when done. Off
   *  by default — reserve for hero terminal moments (e.g. the login screen H1).
   *  For routine page titles, omit this so the typewriter just prints once. */
  cursor?: boolean;
  className?: string;
};

const BLINK_CLASS = "animate-hud-blink";

// Prints `text` one character at a time. Optionally trails a block cursor.
// Re-types whenever the `text` prop changes (e.g. on mode toggle).
// Respects prefers-reduced-motion: shows the full text immediately.
//
// Implementation: DOM-direct via refs. No React state on each tick — that
// would re-render this component (and any text-shadow descendants in the
// header) `text.length × 1000 / speed` times per page load.
//
// Layout is reserved by an invisible "ghost" copy of the full text so the
// parent doesn't relayout as letters print in.
export function Typewriter({
  text,
  speed = 28,
  delay = 0,
  cursor = false,
  className,
}: Props) {
  const textRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const textEl = textRef.current;
    const cursorEl = cursorRef.current;
    if (!textEl) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      textEl.textContent = text;
      cursorEl?.classList.add(BLINK_CLASS);
      return;
    }

    textEl.textContent = "";
    cursorEl?.classList.remove(BLINK_CLASS);

    let i = 0;
    let intervalId: number | null = null;
    const startId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        i += 1;
        textEl.textContent = text.slice(0, i);
        if (i >= text.length) {
          if (intervalId !== null) window.clearInterval(intervalId);
          cursorEl?.classList.add(BLINK_CLASS);
        }
      }, speed);
    }, delay);

    return () => {
      window.clearTimeout(startId);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [text, speed, delay]);

  return (
    <span
      className={className}
      style={{ position: "relative", display: "inline-block" }}
    >
      {/* Ghost: full text (and cursor, if any) reserves layout width + height
          so the parent doesn't reflow as letters print in. visibility:hidden
          keeps it out of paint and out of the accessibility tree. */}
      <span aria-hidden style={{ visibility: "hidden" }}>
        {text}
        {cursor && <span style={{ marginLeft: "0.05em" }}>▋</span>}
      </span>
      {/* Visible typed output layered on top of the ghost. textContent is
          mutated directly (see effect above). */}
      <span aria-hidden style={{ position: "absolute", left: 0, top: 0 }}>
        <span ref={textRef} />
        {cursor && (
          <span ref={cursorRef} style={{ marginLeft: "0.05em" }}>
            ▋
          </span>
        )}
      </span>
      {/* Screen readers hear the full text immediately, not char-by-char. */}
      <span className="sr-only">{text}</span>
    </span>
  );
}
