import * as React from "react";

import { cn } from "@/lib/utils";

import styles from "./input.module.css";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        `${styles.input} w-full min-w-0 px-3 py-2.5 text-xs font-medium outline-none disabled:pointer-events-none disabled:cursor-not-allowed`,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
