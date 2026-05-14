import { posthog } from "./posthog.js";

export const warning = {
  send<L>(name: string, _log?: () => L) {
    const log = _log?.();
    console.error(`warning ${name} : `, log);
    posthog?.capture({
      event: "developer_warning",
      properties: {
        name,
        log: log ? JSON.stringify(log, null, 2) : undefined,
      },
    });
  },

  async ifSlow<T, L>(
    name: string,
    { ms, log }: { ms: number; log?: () => L },
    fn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;

    if (duration > ms) {
      posthog?.capture({
        event: "developer_warning",
        properties: {
          name,
          condition: "duration",
          conditionValue: `${duration}ms / ${ms}ms`,
          log: log ? JSON.stringify(log(), null, 2) : undefined,
        },
      });
    }

    return result;
  },

  async ifWhen<T, L>(
    name: string,
    { when, log }: { when: (result: T) => boolean; log?: () => L },
    fn: () => Promise<T>,
  ): Promise<T> {
    const result = await fn();

    if (when(result)) {
      posthog?.capture({
        event: "developer_warning",
        properties: {
          name,
          condition: "resultCheck",
          conditionValue: "",
          log: log ? JSON.stringify(log(), null, 2) : undefined,
        },
      });
    }

    return result;
  },
};
