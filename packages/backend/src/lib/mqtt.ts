import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";

// ============================================================
// Config
// ============================================================
export function getBrokerHost(): string {
  const url = process.env.AGENT_MQTT_BROKER_URL;
  // "mqtts://host:port" → "host"
  return new URL(url.replace("mqtts://", "https://")).hostname;
}

export function getRegion(): string {
  // Extract region from broker host: xxx.iot.<region>.amazonaws.com
  const host = getBrokerHost();
  const match = host.match(/\.iot\.([^.]+)\.amazonaws\.com/);
  if (!match) throw new Error(`Cannot extract region from broker host: ${host}`);
  return match[1];
}

// ============================================================
// IoT credential resolution — used by SigV4-signed WSS URLs for
// the API Lambda's own MQTT publishes and the browser session.
// ============================================================
type IotCredentials = { accessKeyId: string; secretAccessKey: string; sessionToken?: string };

export async function resolveIotCredentials(): Promise<IotCredentials> {
  const region = getRegion();
  const roleArn = process.env.AGENT_MQTT_ROLE_ARN;

  if (roleArn) {
    const sts = new STSClient({ region });
    const assumed = await sts.send(new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: `mqtt-server-${Date.now()}`,
      DurationSeconds: 900,
    }));
    const creds = assumed.Credentials!;
    return {
      accessKeyId: creds.AccessKeyId!,
      secretAccessKey: creds.SecretAccessKey!,
      sessionToken: creds.SessionToken,
    };
  } else {
    const { fromNodeProviderChain } = await import("@aws-sdk/credential-providers");
    const resolved = await fromNodeProviderChain({ clientConfig: { region } })();
    return {
      accessKeyId: resolved.accessKeyId,
      secretAccessKey: resolved.secretAccessKey,
      sessionToken: resolved.sessionToken,
    };
  }
}
