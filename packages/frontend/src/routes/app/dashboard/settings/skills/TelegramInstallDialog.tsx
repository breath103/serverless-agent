import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalBody, ModalHeader, ModalShell } from "@/components/ui/modal";
import { useMutation } from "@/hooks/useMutation";
import { api } from "@/lib/api";

export function TelegramInstallDialog({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState("");

  const install = useMutation(
    async () => await api.fetch("/api/skills/install/telegram", "POST", { body: { botToken: token.trim() } }),
    [token],
  );

  const trimmed = token.trim();
  const errorMessage = install.status === "error" ? install.error.message : null;

  return (
    <ModalShell onClose={onClose} presentation="small">
      <ModalHeader title="Connect Telegram" onClose={onClose} />
      <ModalBody className="px-5 py-4">
        <p className="mb-3 text-[0.6875rem] tracking-wider text-cream-dim uppercase">
          Paste the bot token from @BotFather. We'll register the webhook and
          mirror messages once you say hi to the bot.
        </p>
        <Input
          autoFocus
          value={token}
          placeholder="123456:ABC-DEF..."
          onChange={(e) => setToken(e.target.value)}
        />
        {errorMessage && (
          <div className="mt-3 border border-red px-3 py-2 text-[0.6875rem] tracking-wider text-red uppercase">
            {errorMessage}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="default" onClick={onClose}>CANCEL</Button>
          <Button
            variant="primary"
            disabled={trimmed.length === 0}
            loading={install.status === "loading"}
            onClick={() => {
              void install.call().then((r) => {
                if (r) onClose();
              });
            }}
          >
            CONNECT
          </Button>
        </div>
      </ModalBody>
    </ModalShell>
  );
}
