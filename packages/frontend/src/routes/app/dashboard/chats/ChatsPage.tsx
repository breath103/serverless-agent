import { PlusIcon } from "@phosphor-icons/react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/routes/app/PageShell";

import { ChatConversation, NewChatConversation } from "./ChatConversation";
import { ChatList } from "./ChatList";

export function ChatsPage() {
  const navigate = useNavigate();
  const activeChatId = useRouterState({
    select: (s) => s.location.pathname.match(/^\/dashboard\/chats\/([^/]+)$/)?.[1],
  });

  return (
    <PageShell
      title="Chats"
      scroll={false}
      actions={(
        <Button size="sm" variant="primary" onClick={() => void navigate({ to: "/dashboard/chats" })}>
          <PlusIcon size={13} weight="bold" />
          <span>NEW</span>
        </Button>
      )}
    >
      <div className="flex h-full overflow-hidden">
        <ChatList />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {activeChatId ? <ChatConversation key={activeChatId} sessionId={activeChatId} /> : <NewChatConversation />}
        </main>
      </div>
    </PageShell>
  );
}
