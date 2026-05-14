declare namespace NodeJS {
  interface ProcessEnv {
    // Agent storage — public S3 bucket URL prefix for user-uploaded files
    // (call recordings, attachments). Append "/users/<userId>/..." to get a
    // direct playback/view URL.
    AGENT_STORAGE_URL: string;

    // Analytics
    POSTHOG_KEY: string | undefined;
    POSTHOG_HOST: string | undefined;
  }
}

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}
