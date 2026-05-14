declare namespace NodeJS {
  interface ProcessEnv {
    // LLM + skills
    ANTHROPIC_API_KEY: string;
    TAVILY_API_KEY: string;

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

    // AWS Lambda runtime region (provided by AWS).
    AWS_REGION: string;

    // Optional observability
    POSTHOG_KEY: string | undefined;
    POSTHOG_HOST: string | undefined;
    AXIOM_API_TOKEN: string | undefined;
    AXIOM_DATASET: string | undefined;
  }
}
