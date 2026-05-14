import { TrashIcon } from "@phosphor-icons/react";

import { ContextMenu, type ContextMenuState, MenuItem } from "@/components/ui/context-menu";
import { useConfirm } from "@/components/ui/modal";
import { useMutation } from "@/hooks/useMutation";
import { api } from "@/lib/api";

export type MemoryContextMenuState = ContextMenuState & { id: string };

export function MemoryContextMenu({
  state,
  onClose,
}: {
  state: MemoryContextMenuState | null;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const deleteMemory = useMutation(
    async (id: string) => {
      await api.fetch("/api/memories/:id", "DELETE", { params: { id } });
    },
    [],
  );

  const handleDelete = async () => {
    if (!state) return;
    const { id } = state;
    onClose();
    const ok = await confirm({
      title: "Delete memory?",
      description: "This can't be undone.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    await deleteMemory.call(id);
  };

  return (
    <ContextMenu state={state} onClose={onClose}>
      <MenuItem icon={TrashIcon} label="Delete" variant="destructive" onClick={() => void handleDelete()} />
    </ContextMenu>
  );
}
