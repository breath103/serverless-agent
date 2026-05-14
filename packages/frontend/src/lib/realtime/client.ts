import mqtt from "mqtt";
import type { Observable } from "rxjs";
import { BehaviorSubject, Subject } from "rxjs";
import superjson from "superjson";

export type RealtimeStatus =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "connected"; since: number }
  | { kind: "reconnecting"; attempt: number; nextRetryMs: number }
  | { kind: "error"; message: string };

/** Caller-supplied fetcher that yields a signed WSS URL + channel to subscribe to. */
export type GetRealtimeConnection = () => Promise<{ url: string; channel: string }>;

const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
const JITTER_RATIO = 0.3;

export class RealtimeClient<TEvent> {
  private readonly eventSubject = new Subject<TEvent>();
  private readonly statusSubject = new BehaviorSubject<RealtimeStatus>({ kind: "idle" });

  private client: mqtt.MqttClient | null = null;
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;

  readonly event$: Observable<TEvent> = this.eventSubject.asObservable();
  readonly status$: Observable<RealtimeStatus> = this.statusSubject.asObservable();

  constructor(private readonly getConnection: GetRealtimeConnection) {}

  start(): void {
    if (this.stopped) return;
    if (this.statusSubject.value.kind !== "idle") return;
    void this.openLoop();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.client?.end(true);
    this.client = null;
    this.statusSubject.next({ kind: "idle" });
  }

  private async openLoop(): Promise<void> {
    if (this.stopped) return;
    this.statusSubject.next({ kind: "connecting" });

    try {
      const { url, channel } = await this.getConnection();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- stopped may flip during await
      if (this.stopped) return;

      const client = mqtt.connect(url, {
        protocolVersion: 4,
        reconnectPeriod: 0,
        clientId: `browser-${Math.random().toString(36).slice(2, 10)}`,
      });

      client.on("connect", () => {
        client.subscribe(channel, { qos: 1 }, (err) => {
          if (err) {
            this.scheduleRetry(`Subscribe failed: ${err.message}`);
            return;
          }
          this.attempt = 0;
          this.statusSubject.next({ kind: "connected", since: Date.now() });
        });
      });

      client.on("message", (_topic, payload) => {
        try {
          const event = superjson.parse<TEvent>(payload.toString());
          this.eventSubject.next(event);
        } catch (err) {
          console.warn("[realtime] dropped unparseable event", err);
        }
      });

      client.on("error", (err) => {
        this.scheduleRetry(err.message);
      });

      client.on("close", () => {
        if (this.client === client) {
          this.client = null;
          this.scheduleRetry("Connection closed");
        }
      });

      this.client = client;
    } catch (err) {
      this.scheduleRetry(err instanceof Error ? err.message : String(err));
    }
  }

  private scheduleRetry(reason: string): void {
    if (this.stopped) return;
    if (this.retryTimer) return;

    this.client?.end(true);
    this.client = null;

    this.attempt += 1;
    const baseDelay = Math.min(BASE_RETRY_MS * 2 ** (this.attempt - 1), MAX_RETRY_MS);
    const jitter = baseDelay * JITTER_RATIO * (Math.random() * 2 - 1);
    const delay = Math.max(500, Math.round(baseDelay + jitter));

    this.statusSubject.next({
      kind: "reconnecting",
      attempt: this.attempt,
      nextRetryMs: delay,
    });
    console.warn(`[realtime] ${reason} — retry #${this.attempt} in ${delay}ms`);

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.openLoop();
    }, delay);
  }
}
