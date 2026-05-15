declare namespace NodeJS {
  interface ProcessEnv {
    // LLM + skills
    ANTHROPIC_API_KEY: string;
    TAVILY_API_KEY: string;

    // Google OAuth (Cloud Console → APIs & Services → Credentials → OAuth client of type Web).
    // Authorized redirect URI in dev: http://localhost:<edge.devPort>/api/skills/oauth/callback
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;

    // Agent state storage (S3)
    AGENT_STORAGE_BUCKET: string; // @cdk-injected

    // Realtime (IoT MQTT)
    AGENT_MQTT_BROKER_URL: string; // @cdk-injected
    AGENT_MQTT_ROLE_ARN: string | undefined; // @cdk-injected
    AGENT_MQTT_NAMESPACE: string;

    // DynamoDB table-name prefix (CDK-injected). Each repo derives its
    // table name as `${TABLE_NAME_PREFIX}-<entity>`.
    TABLE_NAME_PREFIX: string; // @cdk-injected

    // Optional: local DynamoDB endpoint (when set, ddb client points here with dummy creds)
    DDB_LOCAL_ENDPOINT: string | undefined;

    // Telegram Bot API base URL. Defaults to https://api.telegram.org.
    // `e2e_telegram.ts` overrides this in-process to point at a mock server
    // that captures every Bot API call.
    TELEGRAM_BOT_API_BASE: string | undefined;

    // Optional public HTTPS URL for the edge proxy (e.g. a cloudflared tunnel).
    // When set, the Telegram install route registers webhooks against this host
    // instead of the request's edge URL — required for end-to-end testing
    // against real Telegram from a local dev machine.
    EDGE_PUBLIC_URL: string | undefined;

    // AWS Lambda runtime region (provided by AWS).
    AWS_REGION: string;

    // Optional observability
    POSTHOG_KEY: string | undefined;
    POSTHOG_HOST: string | undefined;
    AXIOM_API_TOKEN: string | undefined;
    AXIOM_DATASET: string | undefined;
  }
}
