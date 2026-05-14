import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";

import { route } from "../../lib/app-context.js";
import { signIotWebSocketUrl } from "../../lib/iot-sigv4.js";
import { getBrokerHost, getRegion, resolveIotCredentials } from "../../lib/mqtt.js";
import { publishRealtimeEvent, userTopic } from "../../lib/realtime-publish.js";
import { singleton } from "../../lib/singleton.js";

const stsClient = singleton(() => new STSClient({ region: getRegion() }));

/**
 * Scope the WSS URL to one user's topics via STS AssumeRole + session policy.
 * In prod, AGENT_MQTT_ROLE_ARN is injected by CDK; the Lambda's role assumes
 * it with a session policy that narrows IoT perms to this user's topics.
 *
 * In local dev (AGENT_MQTT_ROLE_ARN unset), falls back to the developer's
 * local credential chain — unscoped, but acceptable for solo-dev.
 */
async function scopedIotCredentialsFor(userId: string) {
  const roleArn = process.env.AGENT_MQTT_ROLE_ARN;
  if (!roleArn) return resolveIotCredentials();

  const region = getRegion();
  const topic = userTopic(userId);
  const sessionPolicy = {
    Version: "2012-10-17",
    Statement: [{
      Effect: "Allow",
      Action: "iot:Connect",
      Resource: `arn:aws:iot:${region}:*:client/*`,
    }, {
      Effect: "Allow",
      Action: "iot:Subscribe",
      Resource: `arn:aws:iot:${region}:*:topicfilter/${topic}`,
    }, {
      Effect: "Allow",
      Action: "iot:Receive",
      Resource: `arn:aws:iot:${region}:*:topic/${topic}`,
    }],
  };

  const result = await stsClient.get().send(new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: `rt-${userId}`,
    DurationSeconds: 3600,
    Policy: JSON.stringify(sessionPolicy),
  }));

  const creds = result.Credentials!;
  return {
    accessKeyId: creds.AccessKeyId!,
    secretAccessKey: creds.SecretAccessKey!,
    sessionToken: creds.SessionToken,
  };
}

export const routes = [
  route("/api/realtime/connection", "GET", {
    handler: async ({ c }) => {
      const user = c.get("requireUser")();
      const credentials = await scopedIotCredentialsFor(user.id);
      const host = getBrokerHost();
      const region = getRegion();
      const url = signIotWebSocketUrl({ host, region, credentials });
      return {
        url,
        channel: userTopic(user.id),
      };
    },
  }),

  route("/api/realtime/echo", "POST", {
    body: {
      message: z.string().min(1).max(4096),
      sentAt: z.number(),
    },
    handler: async ({ body, c }) => {
      const user = c.get("requireUser")();
      const publishedAt = Date.now();

      try {
        await publishRealtimeEvent(user.id, {
          type: "echo",
          message: body.message,
          sentAt: body.sentAt,
          publishedAt,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new HTTPException(500, { message: `IoT publish failed: ${message}` });
      }

      return { publishedAt };
    },
  }),
] as const;
