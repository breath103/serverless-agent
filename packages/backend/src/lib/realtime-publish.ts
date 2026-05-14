import superjson from "superjson";

import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";

import { getBrokerHost, getRegion } from "./mqtt.js";
import type { RealtimeEvent } from "./realtime-events.js";
import { singleton } from "./singleton.js";

const iotDataClient = singleton(() => new IoTDataPlaneClient({
  region: getRegion(),
  endpoint: `https://${getBrokerHost()}`,
}));

/** One MQTT topic per user; event `type` discriminates variants. */
export function userTopic(userId: string): string {
  const ns = process.env.AGENT_MQTT_NAMESPACE;
  return `${ns}/users/${userId}/events`;
}

/** Publish a typed realtime event to the user's MQTT topic. */
export async function publishRealtimeEvent(userId: string, event: RealtimeEvent): Promise<void> {
  await iotDataClient.get().send(new PublishCommand({
    topic: userTopic(userId),
    qos: 1,
    payload: Buffer.from(superjson.stringify(event)),
  }));
}
