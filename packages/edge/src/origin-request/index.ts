import type {
  CloudFrontRequest,
  CloudFrontRequestEvent,
  CloudFrontRequestResult,
} from "aws-lambda";
import * as SSMParameters from "shared/ssm-parameters";

import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

// Injected at build time by esbuild
const PROJECT = process.env.PROJECT!;
const SSM_REGION = process.env.SSM_REGION!;

const ssm = new SSMClient({ region: SSM_REGION });

let cachedBackendUrl: { value: string | null; expires: number } | null = null;
const BACKEND_URL_TTL_MS = 60 * 1000;

async function getBackendUrl(): Promise<string | null> {
  if (cachedBackendUrl && cachedBackendUrl.expires > Date.now()) {
    return cachedBackendUrl.value;
  }
  try {
    const result = await ssm.send(
      new GetParameterCommand({ Name: SSMParameters.backendUrlName({ project: PROJECT }) })
    );
    const value = result.Parameter?.Value ?? null;
    cachedBackendUrl = { value, expires: Date.now() + BACKEND_URL_TTL_MS };
    return value;
  } catch (e) {
    console.error("SSM lookup failed:", e);
    return null;
  }
}

export const handler = async (
  event: CloudFrontRequestEvent
): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;

  // API requests: route to backend Lambda
  if (uri.startsWith("/api/") || uri === "/api") {
    const backendUrl = await getBackendUrl();

    if (!backendUrl) {
      return {
        status: "404",
        statusDescription: "Not Found",
        body: "Backend URL not configured",
      };
    }

    return rewriteToBackend(request, backendUrl);
  }

  // Frontend requests: SPA routing. Serve index.html for client-side routes
  // (paths without file extensions); static files served directly from S3.
  const filename = uri.split("/").pop() ?? "";
  const hasExtension = filename.includes(".");

  if (uri === "/" || uri === "" || !hasExtension) {
    request.uri = "/index.html";
  }

  return request;
};

function rewriteToBackend(
  request: CloudFrontRequest,
  backendUrl: string
): CloudFrontRequest {
  const url = new URL(backendUrl);

  request.origin = {
    custom: {
      domainName: url.hostname,
      port: 443,
      protocol: "https",
      path: "",
      sslProtocols: ["TLSv1.2"],
      readTimeout: 30,
      keepaliveTimeout: 5,
      customHeaders: {},
    },
  };

  request.headers.host = [{ key: "Host", value: url.hostname }];

  return request;
}
