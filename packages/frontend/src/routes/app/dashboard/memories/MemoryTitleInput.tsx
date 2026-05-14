import { cn } from "@/lib/utils";

// Heading-styled input. Commits on blur; Enter blurs to trigger commit.
export function MemoryTitleInput({
  value,
  onChange,
  onCommit,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="UNTITLED"
      className={cn(
        "w-full bg-transparent text-amber outline-none",
        "placeholder:text-amber-dim",
        className,
      )}
      style={{
        fontSize: "1.125rem",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    />
  );
}
