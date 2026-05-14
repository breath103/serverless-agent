import { TrashIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";

import { ContextMenu, type ContextMenuState, MenuItem } from "@/components/ui/context-menu";
import { useConfirm } from "@/components/ui/modal";
import { useMutation } from "@/hooks/useMutation";
import { api } from "@/lib/api";

export type ChatContextMenuState = ContextMenuState & { id: string };

export function ChatContextMenu({
  state,
  activeChatId,
  onClose,
}: {
  state: ChatContextMenuState | null;
  activeChatId: string | undefined;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const deleteChat = useMutation(
    async (id: string) => {
      await api.fetch("/api/chat/:id", "DELETE", { params: { id } });
      return id;
    },
    [],
  );

  const handleDelete = async () => {
    if (!state) return;
    const { id } = state;
    onClose();
    const ok = await confirm({
      title: "Delete chat?",
      description: "This can't be undone.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    const deleted = await deleteChat.call(id);
    if (deleted && activeChatId === id) void navigate({ to: "/dashboard/chats" });
  };

  return (
    <ContextMenu state={state} onClose={onClose}>
      <MenuItem icon={TrashIcon} label="Delete" variant="destructive" onClick={() => void handleDelete()} />
    </ContextMenu>
  );
}
