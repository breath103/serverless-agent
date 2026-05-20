import z from "zod";

interface GoogleOAuthConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
}

export function defaultGoogleOAuthConfig(extraScopes: string[] = []): GoogleOAuthConfig {
  return {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [...extraScopes, "openid", "email", "profile"],
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
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

export async function exchangeOAuth2Code(
  config: GoogleOAuthConfig,
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

export async function refreshOAuth2Token(
  config: GoogleOAuthConfig,
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

export function buildOAuth2AuthUrl(
  config: GoogleOAuthConfig,
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

const googleUserInfoSchema = z.object({
  id: z.string(),
  email: z.string(),
  verified_email: z.boolean().optional(),
  name: z.string(),
});

export async function fetchGoogleUserInfo(accessToken: string): Promise<{
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo API ${res.status}: ${await res.text()}`);
  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- untyped JSON body, validated below
  const body: unknown = await res.json();
  const parsed = googleUserInfoSchema.parse(body);
  return {
    sub: parsed.id,
    email: parsed.email,
    emailVerified: parsed.verified_email ?? false,
    name: parsed.name,
  };
}
