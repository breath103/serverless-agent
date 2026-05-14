import * as React from "react";

import { cn } from "@/lib/utils";

import styles from "./input.module.css";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        `${styles.input} h-10 w-full min-w-0 px-3 py-2 text-xs font-medium outline-none disabled:pointer-events-none disabled:cursor-not-allowed`,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
