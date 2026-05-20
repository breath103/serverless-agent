declare namespace NodeJS {
  interface ProcessEnv {
    // Skills
    TAVILY_API_KEY: string;

    // Google OAuth (Cloud Console → APIs & Services → Credentials → OAuth client of type Web).
    // Authorized redirect URIs in dev:
    //   - http://localhost:<edge.devPort>/api/auth/google/callback   (user sign-in)
    //   - http://localhost:<edge.devPort>/api/skills/oauth/callback  (google-calendar skill)
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

    // Worker Lambda alias ARN. CDK injects it on the API Lambda; the API
    // `invokeAsyncLambda`s the Worker for `run_chat` and other background
    // work. Absent in local dev — `invokeAsyncLambda` falls back to running
    // the handler inline against the long-lived dev Node process.
    AGENT_WORKER_FUNCTION_NAME: string | undefined; // @cdk-injected

    // Optional: local DynamoDB endpoint (when set, ddb client points here with dummy creds)
    DDB_LOCAL_ENDPOINT: string | undefined;

    // Telegram Bot API base URL. Defaults to https://api.telegram.org.
    // `e2e_telegram.ts` overrides this in-process to point at a mock server
    // that captures every Bot API call.
    TELEGRAM_BOT_API_BASE: string | undefined;

    // Public HTTPS URL for the edge proxy. In prod, CDK injects this from
    // tss.json's domain + subdomainMap (the subdomain that maps to "main").
    // In local dev, set by a cloudflared tunnel.
    EDGE_PUBLIC_URL: string; // @cdk-injected

    // AWS Lambda runtime region — auto-provided by the Lambda runtime in
    // prod. Reserved env var (CFN rejects it on `Function.environment`),
    // so never set it ourselves.
    AWS_REGION: string; // @cdk-injected

    // Optional observability
    POSTHOG_KEY: string | undefined;
    POSTHOG_HOST: string | undefined;
    AXIOM_API_TOKEN: string | undefined;
    AXIOM_DATASET: string | undefined;
  }
}
