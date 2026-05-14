import { type Span, SpanStatusCode, trace, type Tracer } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

class Telemetry {
  private provider: NodeTracerProvider;
  private tracer: Tracer;

  constructor(opts: { axiomToken: string; axiomDataset: string }) {
    this.provider = new NodeTracerProvider({
      resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: "serverless-agent-backend" }),
      spanProcessors: [
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: "https://api.axiom.co/v1/traces",
            headers: {
              "Authorization": `Bearer ${opts.axiomToken}`,
              "X-Axiom-Dataset": opts.axiomDataset,
            },
          }),
        ),
      ],
    });
    this.provider.register();
    this.tracer = trace.getTracer("serverless-agent");
  }

  /**
   * Create a root span for an entire Lambda invocation.
   * All `measure()` calls inside `fn` become child spans automatically.
   */
  async trace<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    return this.tracer.startActiveSpan(name, async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Wrap a function in a child span.
   * Accepts both sync and async functions. Nests under the active span from `trace()`.
   */
  measure<T>(name: string, fn: () => T): T;
  measure<T>(name: string, attributes: Record<string, string | number | boolean>, fn: () => T): T;
  measure<T>(
    name: string,
    fnOrAttributes: (() => T) | Record<string, string | number | boolean>,
    maybeFn?: () => T,
  ): T {
    const fn = typeof fnOrAttributes === "function" ? fnOrAttributes : maybeFn!;
    const attributes = typeof fnOrAttributes === "function" ? undefined : fnOrAttributes;

    return this.tracer.startActiveSpan(name, (span) => {
      if (attributes) span.setAttributes(attributes);
      try {
        const result = fn();
        // If result is a promise, wait for it before ending the span
        if (result instanceof Promise) {
          return result.then(
            (value) => {
              span.setStatus({ code: SpanStatusCode.OK });
              span.end();
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- T is Promise<X> here, value is the resolved X
              return value;
            },
            (err) => {
              span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
              span.end();
              throw err;
            },
          ) as T;
        }
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
        span.end();
        throw err;
      }
    });
  }

  /** Flush all pending spans. Call before Lambda exits. */
  async flush(): Promise<void> {
    await this.provider.forceFlush();
  }
}

export const telemetry = (process.env.AXIOM_API_TOKEN && process.env.AXIOM_DATASET)
  ? new Telemetry({ axiomToken: process.env.AXIOM_API_TOKEN, axiomDataset: process.env.AXIOM_DATASET })
  : null;
