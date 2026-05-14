import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useRef } from "react";

type Precision = "second" | "millisecond";

type ClockProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  precision?: Precision;
};

const precisionIntervalMs: Record<Precision, number> = {
  second: 1000,
  millisecond: 100,
};

export function Clock({ precision = "second", ...props }: ClockProps) {
  const timeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      if (timeRef.current) {
        timeRef.current.textContent = formatUtc(new Date(), precision);
      }
    };

    update();
    const id = window.setInterval(update, precisionIntervalMs[precision]);
    return () => window.clearInterval(id);
  }, [precision]);

  return <div ref={timeRef} {...props} />;
}

function formatUtc(d: Date, precision: Precision): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const base = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;

  if (precision === "millisecond") {
    const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
    return `${base}.${ms} UTC`;
  }

  return `${base} UTC`;
}
