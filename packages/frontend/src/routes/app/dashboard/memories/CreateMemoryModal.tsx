import { Dialog } from "radix-ui";
import { useForm } from "react-hook-form";

import { XIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type FormValues = { title: string; content: string };

export function CreateMemoryModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/88 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(92vw,520px)] -translate-1/2",
            "flex flex-col overflow-hidden bg-background hud-panel",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out",
            "data-[state=open]:animate-in data-[state=open]:fade-in",
            "duration-150 data-[state=closed]:ease-in data-[state=open]:ease-out",
          )}
          style={{ padding: 0 }}
        >
          <CreateForm onClose={() => onOpenChange(false)} onCreated={onCreated} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CreateForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { register, handleSubmit, setError, formState } = useForm<FormValues>({
    defaultValues: { title: "", content: "" },
    mode: "onChange",
  });

  const onSubmit = handleSubmit(async ({ title, content }) => {
    try {
      const created = await api.fetch("/api/memories", "POST", {
        body: { title: title.trim(), content },
      });
      onCreated(created.id);
      onClose();
    } catch (err) {
      setError("root", { message: err instanceof Error ? err.message : "Failed to create memory." });
    }
  });

  return (
    <form onSubmit={(e) => { void onSubmit(e); }} className="flex flex-col">
      <header className="flex items-center justify-between border-b border-amber px-5 pt-3 pb-2.5">
        <Dialog.Title asChild>
          <h2 className="hud-title" style={{ fontSize: "0.9375rem" }}>NEW MEMORY</h2>
        </Dialog.Title>
        <Dialog.Close asChild>
          <button type="button" aria-label="Close" className="icon-ghost-button size-8">
            <XIcon size={16} />
          </button>
        </Dialog.Close>
      </header>

      <div className="flex flex-col gap-4 p-5">
        <div>
          <label htmlFor="memory-title" className="mb-1.5 block hud-label">TITLE</label>
          <Input
            id="memory-title"
            placeholder="e.g. notes from the offsite"
            {...register("title", { required: true, validate: (v) => v.trim().length > 0 })}
          />
        </div>

        <div>
          <label htmlFor="memory-content" className="mb-1.5 block hud-label">CONTENT</label>
          <Textarea
            id="memory-content"
            placeholder="Markdown notes…"
            rows={6}
            {...register("content", { required: true, validate: (v) => v.trim().length > 0 })}
          />
          <p className="mt-2 hud-caption">
            ON SAVE, THE AGENT REVIEWS THIS MEMORY AND UPDATES THE ONTOLOGY — A NEW CHAT WILL APPEAR.
          </p>
        </div>

        {formState.errors.root && (
          <p className="border border-red px-3 py-2 text-xs text-red">! {formState.errors.root.message}</p>
        )}
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-amber px-5 py-3">
        <Button type="button" variant="default" onClick={onClose}>CANCEL</Button>
        <Button type="submit" variant="primary" loading={formState.isSubmitting} disabled={!formState.isValid}>
          CREATE
        </Button>
      </footer>
    </form>
  );
}
