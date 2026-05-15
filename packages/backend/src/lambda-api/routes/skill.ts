import { randomBytes } from "node:crypto";

import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { edgeUrl, route } from "../../lib/app-context.js";
import { publishRealtimeEvent } from "../../lib/realtime-publish.js";
import type { InstallableSkillId, Oauth2InstallSkillMap } from "../../skills/index.js";
import { skillHandlers } from "../../skills/index.js";
import { telegramGetMe, telegramSetWebhook } from "../../skills/telegram.js";
import { userSkillsRepo } from "../../skills/user-skills-repository.js";

const OAUTH_CALLBACK_PATH = "/api/skills/oauth/callback";

function requireOauth2Handler(skillId: string): Oauth2InstallSkillMap[keyof Oauth2InstallSkillMap] {
  if (!(skillId in skillHandlers)) {
    throw new HTTPException(422, { message: `Unknown skill: ${skillId}` });
  }
  const handler = skillHandlers[skillId as keyof typeof skillHandlers];
  if (handler.install.type !== "oauth2") {
    throw new HTTPException(422, { message: `Skill "${skillId}" is not oauth2-installable` });
  }
  return handler as Oauth2InstallSkillMap[keyof Oauth2InstallSkillMap];
}

export const routes = [
  // Step 1: returns Google's consent URL. State encodes { skillId, userId } so
  // the callback knows which user/skill the redirect belongs to.
  route("/api/skills/install/oauth/redirect", "POST", {
    body: { skillId: z.string() },
    handler: ({ body, c }) => {
      const user = c.get("requireUser")();
      const handler = requireOauth2Handler(body.skillId);

      const state = Buffer.from(JSON.stringify({
        skillId: body.skillId,
        userId: user.id,
      })).toString("base64url");
      const redirectUri = edgeUrl(c, OAUTH_CALLBACK_PATH);
      return { redirectUrl: handler.install.getInstallUrl(redirectUri, state) };
    },
  }),

  // Step 2: Google redirects back here with { code, state }. Exchange for
  // tokens, persist via upsert (dedupe on user+skill), then 302 to settings.
  route(OAUTH_CALLBACK_PATH, "GET", {
    query: {
      code: z.string().optional(),
      state: z.string(),
      error: z.string().optional(),
    },
    handler: async ({ query, c }) => {
      // eslint-disable-next-line @typescript-eslint/no-restricted-types -- base64-JSON state is untyped wire data; validated below
      const decoded: unknown = JSON.parse(Buffer.from(query.state, "base64url").toString());
      const stateSchema = z.object({ skillId: z.string(), userId: z.string() });
      const { skillId, userId } = stateSchema.parse(decoded);

      if (query.error || !query.code) {
        const params = new URLSearchParams({
          skill: skillId,
          error: query.error ?? "unknown_error",
        });
        return c.redirect(edgeUrl(c, `/dashboard/settings/skills?error=${params}`));
      }

      const handler = requireOauth2Handler(skillId);
      const redirectUri = edgeUrl(c, OAUTH_CALLBACK_PATH);
      const config = await handler.install.completeInstall({ code: query.code, redirectUri });

      const row = await userSkillsRepo.upsert({
        userId,
        skillId: skillId as InstallableSkillId,
        config,
      });
      await publishRealtimeEvent(userId, { type: "entity_update", table: "user_skills", op: "upsert", row });

      return c.redirect(edgeUrl(c, `/dashboard/settings/skills?connected=${encodeURIComponent(skillId)}`));
    },
  }),

  route("/api/skills/install/telegram", "POST", {
    body: { botToken: z.string().min(1) },
    handler: async ({ body, c }) => {
      const user = c.get("requireUser")();

      const { bot_username } = await telegramGetMe(body.botToken).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        throw new HTTPException(422, { message: `Telegram getMe failed: ${msg}` });
      });
      const webhook_secret = randomBytes(32).toString("hex");

      const row = await userSkillsRepo.upsert({
        userId: user.id,
        skillId: "telegram",
        config: {
          bot_token: body.botToken,
          telegram_chat_id: null,
          chat_session_id: null,
          webhook_secret,
          bot_username,
        },
      });

      // Dev skips setWebhook (Telegram won't call localhost) unless a tunnel URL is set.
      const publicHost = process.env.EDGE_PUBLIC_URL;
      const shouldRegister = process.env.NODE_ENV !== "development" || publicHost !== undefined;
      if (shouldRegister) {
        const webhookPath = `/api/telegram/webhook/${user.id}/${row.id}`;
        const webhookUrl = publicHost ? `${publicHost}${webhookPath}` : edgeUrl(c, webhookPath);
        try {
          await telegramSetWebhook(body.botToken, webhookUrl, webhook_secret);
        } catch (err) {
          await userSkillsRepo.deleteForUser(user.id, row.id);
          const msg = err instanceof Error ? err.message : String(err);
          throw new HTTPException(502, { message: `setWebhook failed: ${msg}` });
        }
      }

      await publishRealtimeEvent(user.id, { type: "entity_update", table: "user_skills", op: "upsert", row });
      return { skillId: "telegram" as const, bot_username };
    },
  }),

  route("/api/skills/installed", "GET", {
    handler: async ({ c }) => {
      const user = c.get("requireUser")();
      return await userSkillsRepo.listForUser(user.id);
    },
  }),

  route("/api/skills/:id", "DELETE", {
    handler: async ({ params, c }): Promise<{ uninstalled: true }> => {
      const user = c.get("requireUser")();

      const row = await userSkillsRepo.getByIdForUser(user.id, params.id);
      if (!row) throw new HTTPException(404, { message: "Skill not installed" });

      const handler = skillHandlers[row.data.skill_id];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- skill_id ↔ config correlation enforced by InstallableSkillConfig discriminator
      await handler.install.uninstall(row.data.config as any).catch((err) => {
        console.warn(`[uninstall] skill=${row.data.skill_id} user=${user.id} id=${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      });

      const deleted = await userSkillsRepo.deleteForUser(user.id, params.id);
      if (deleted) {
        await publishRealtimeEvent(user.id, { type: "entity_update", table: "user_skills", op: "delete", row: deleted });
      }
      return { uninstalled: true };
    },
  }),
] as const;
