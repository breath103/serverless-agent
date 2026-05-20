import z from "zod";

import {
  buildOAuth2AuthUrl,
  defaultGoogleOAuthConfig,
  exchangeOAuth2Code,
  fetchGoogleUserInfo,
  refreshOAuth2Token,
} from "../lib/google-oauth.js";
import { defineSkill } from "./define-skill.js";

const OAuth2TokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string(),
});
const GoogleProfileSchema = z.object({
  email: z.string(),
  name: z.string(),
});

const GoogleSkillConfigSchema = OAuth2TokensSchema.extend(GoogleProfileSchema.shape);
type GoogleSkillConfig = z.infer<typeof GoogleSkillConfigSchema>;

function defineGoogleSkill<TId extends string>(
  { id, displayName, description, scopes }: { id: TId; displayName: string; description: string; scopes: string[] },
) {
  const oauth = defaultGoogleOAuthConfig(scopes);

  return defineSkill({
    id,
    displayName,
    description,
    configSchema: GoogleSkillConfigSchema,
    eventSchema: z.never(),
    install: {
      type: "oauth2",
      getInstallUrl: (redirectUri: string, state: string) => buildOAuth2AuthUrl(oauth, redirectUri, state),
      completeInstall: async (setupResult: { code: string; redirectUri: string }): Promise<GoogleSkillConfig> => {
        const tokens = await exchangeOAuth2Code(oauth, setupResult.code, setupResult.redirectUri);
        const userInfo = await fetchGoogleUserInfo(tokens.accessToken);
        return {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          email: userInfo.email,
          name: userInfo.name,
        };
      },
      uninstall: async (config: GoogleSkillConfig) => {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${config.accessToken}`, {
          method: "POST",
        }).catch(() => {});
      },
      // Returns the input config unchanged when the access token still has >5 min
      // of life. Otherwise calls Google's refresh endpoint and returns a new config.
      // Callers compare-by-equality on `expiresAt` to decide whether to persist.
      refreshConfig: async (config: GoogleSkillConfig): Promise<GoogleSkillConfig> => {
        const buffer = 5 * 60 * 1000;
        if (new Date(config.expiresAt).getTime() - buffer > Date.now()) return config;

        const refreshed = await refreshOAuth2Token(oauth, config.refreshToken);
        return {
          ...config,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
        };
      },
    } as const,
  });
}

export const googleCalendar = defineGoogleSkill({
  id: "google-calendar",
  displayName: "Google Calendar",
  description: "List, create, update, and delete Google Calendar events",
  scopes: ["https://www.googleapis.com/auth/calendar"],
});
