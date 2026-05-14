import { DropdownMenu } from "radix-ui";

import { DotsThreeIcon, TrashIcon } from "@phosphor-icons/react";

import { MenuItem, MenuSurface } from "@/components/ui/context-menu";
import { useConfirm } from "@/components/ui/modal";
import { useMutation } from "@/hooks/useMutation";
import { api } from "@/lib/api";

// Three-dot "more" trigger used on the detail page header.
export function MemoryMoreMenu({
  memoryId,
  onDeleted,
}: {
  memoryId: string;
  onDeleted?: () => void;
}) {
  const confirm = useConfirm();
  const deleteMemory = useMutation(
    async (id: string) => {
      await api.fetch("/api/memories/:id", "DELETE", { params: { id } });
    },
    [],
  );

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete memory?",
      description: "This can't be undone.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    const result = await deleteMemory.call(memoryId);
    if (result !== null) onDeleted?.();
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        type="button"
        aria-label="More actions"
        className="icon-ghost-button size-8"
      >
        <DotsThreeIcon size={18} weight="bold" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} asChild>
          <MenuSurface>
            <DropdownMenu.Item asChild onSelect={() => void handleDelete()}>
              <MenuItem icon={TrashIcon} label="Delete" variant="destructive" />
            </DropdownMenu.Item>
          </MenuSurface>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
