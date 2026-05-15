import type { EntityConfig } from "entity-repository";
import { createRepositoryContext, Repository as RepositoryCore } from "entity-repository";
import { type ReactNode, useCallback, useMemo } from "react";

import type { EntityUpdateEvent, RealtimeTableRowMap } from "@backend/lib/realtime-events";

type PublicEntities = RealtimeTableRowMap;
type AppTableName = keyof PublicEntities;

const entityConfig = {
  memories: { id: "id" },
  chat_sessions: { id: "id" },
  chat_session_messages: { id: "id" },
  profiles: { id: "user_id" },
  user_skills: { id: "id" },
} as const satisfies EntityConfig<PublicEntities>;

type PublicEntityConfig = typeof entityConfig;

const tableNameSet = new Set<string>(Object.keys(entityConfig));

function isTableName(value: string): value is AppTableName {
  return tableNameSet.has(value);
}

export const {
  RepositoryProvider: BaseRepositoryProvider,
  useRepository,
  useRepositoryQuery,
  useRepositoryListQuery,
} = createRepositoryContext<PublicEntities, PublicEntityConfig>();

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(
    () => new RepositoryCore<PublicEntities, PublicEntityConfig>({ entities: entityConfig }),
    [],
  );
  return <BaseRepositoryProvider repository={repository}>{children}</BaseRepositoryProvider>;
}

/**
 * Applies an entity_update event (from MQTT realtime) to the repository by
 * upserting or deleting the row.
 */
export function useApplyEntityUpdate() {
  const repository = useRepository();
  return useCallback(
    (event: EntityUpdateEvent) => {
      if (!isTableName(event.table)) return;
      const table = event.table;
      switch (event.op) {
        case "upsert":
          repository.set(table, event.row);
          return;
        case "delete": {
          const idField = entityConfig[table].id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment
          repository.del(table, { [idField]: (event.row as any)[idField] } as any);
          return;
        }
      }
    },
    [repository],
  );
}
