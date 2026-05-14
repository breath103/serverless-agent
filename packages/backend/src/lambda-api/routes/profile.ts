import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { route } from "../../lib/app-context.js";
import { publishRealtimeEvent } from "../../lib/realtime-publish.js";
import { requireOrThrow } from "../../lib/require-or-throw.js";
import { profilesRepo } from "../../profiles/profiles-repository.js";

const profileNotFound = () => new HTTPException(404, { message: "Profile not found" });

function isValidBcp47(v: string) {
  try {
    new Intl.Locale(v);
    return true;
  } catch {
    return false;
  }
}

function isValidIanaTz(v: string) {
  // Intl.supportedValuesOf excludes aliases like "UTC" / "Etc/UTC" / "US/Pacific".
  // Constructor-based validation accepts any IANA zone string the runtime recognizes.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

export const routes = [
  route("/api/user/profile", "GET", {
    handler: async ({ c }) => {
      const user = c.get("requireUser")();
      return requireOrThrow(await profilesRepo.getByUserId(user.id), profileNotFound);
    },
  }),

  route("/api/user/profile", "PATCH", {
    body: {
      name: z.string().min(1).max(200),
      language: z.string().refine(isValidBcp47, "Invalid BCP 47 language tag"),
      timezone: z.string().refine(isValidIanaTz, "Invalid IANA timezone"),
      about: z.string().max(8000),
    },
    handler: async ({ body, c }) => {
      const user = c.get("requireUser")();
      const row = await profilesRepo.update(user.id, body);
      await publishRealtimeEvent(user.id, { type: "entity_update", table: "profiles", op: "upsert", row });
      return row;
    },
  }),
] as const;
