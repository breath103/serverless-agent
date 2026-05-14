import { createHash, createHmac } from "node:crypto";

import { entries } from "./object.js";

function hmac(key: Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Creates a SigV4-signed WebSocket URL for AWS IoT Core MQTT.
 * Used by the agent Lambda to connect with IAM credentials (no X.509 cert needed).
 */
export function signIotWebSocketUrl(opts: {
  host: string;
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}): string {
  const now = new Date();
  const date = now.toISOString().replace(/[-:]/g, "").slice(0, 8);
  const datetime = date + "T" + now.toISOString().replace(/[-:]/g, "").slice(9, 15) + "Z";

  const service = "iotdevicegateway";
  const scope = `${date}/${opts.region}/${service}/aws4_request`;

  // Canonical query string (security token is NOT included — IoT Core specific)
  const canonicalParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${opts.credentials.accessKeyId}/${scope}`,
    "X-Amz-Date": datetime,
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQueryString = entries(canonicalParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalRequest = [
    "GET",
    "/mqtt",
    canonicalQueryString,
    `host:${opts.host}\n`,
    "host",
    sha256(""),
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    datetime,
    scope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = [date, opts.region, service, "aws4_request"].reduce(
    (key, data) => hmac(key, data),
    Buffer.from(`AWS4${opts.credentials.secretAccessKey}`) as Buffer<ArrayBufferLike>,
  );

  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  let url = `wss://${opts.host}/mqtt?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  if (opts.credentials.sessionToken) {
    url += `&X-Amz-Security-Token=${encodeURIComponent(opts.credentials.sessionToken)}`;
  }

  return url;
}
