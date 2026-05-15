import z from "zod";

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
  const oauth = {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [...scopes, "openid", "email", "profile"],
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };

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

// ============================================================
// OAuth2 helpers
// ============================================================
interface OAuth2Config {
  authUrl: string;
  scopes: string[];
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

// Provider wire format (snake_case). Either an error or a success; the error
// variant is matched first so "error field present" wins over a partial-success
// shape. Runtime-validated so malformed responses throw a typed error.
const oAuth2ErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});
const oAuth2ExchangeSuccessSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});
const oAuth2RefreshSuccessSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

async function parseOrThrow<T>(res: Response, schema: z.ZodType<T>, ctx: string): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- fetch returns untyped JSON; validate below
  const body: unknown = await res.json();
  const asError = oAuth2ErrorSchema.safeParse(body);
  if (asError.success) {
    throw new Error(`OAuth2 ${ctx} failed: ${asError.data.error_description ?? asError.data.error}`);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`OAuth2 ${ctx}: malformed response — ${parsed.error.message}`);
  }
  return parsed.data;
}

async function exchangeOAuth2Code(
  config: OAuth2Config,
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }> {
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = await parseOrThrow(res, oAuth2ExchangeSuccessSchema, "token exchange");
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

async function refreshOAuth2Token(
  config: OAuth2Config,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: string }> {
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const data = await parseOrThrow(res, oAuth2RefreshSuccessSchema, "refresh");
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

function buildOAuth2AuthUrl(
  config: OAuth2Config,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    // offline + consent: required to receive a refresh_token. Google only
    // returns refresh_token on the very first consent unless prompt=consent
    // forces re-consent.
    access_type: "offline",
    prompt: "consent",
    scope: config.scopes.join(" "),
    state,
  });
  return `${config.authUrl}?${params}`;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<{ email: string; name: string }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo API ${res.status}: ${await res.text()}`);
  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- untyped JSON body, validated below
  const body: unknown = await res.json();
  return z.object({ email: z.string(), name: z.string() }).parse(body);
}

export const googleCalendar = defineGoogleSkill({
  id: "google-calendar",
  displayName: "Google Calendar",
  description: "List, create, update, and delete Google Calendar events",
  scopes: ["https://www.googleapis.com/auth/calendar"],
});
