import { loadConfig, namespace, portOffset, type TssConfig } from "shared/config";

// Per-worktree namespace for the local DynamoDB container. `dev.worktree`
// (set in tss.json or overridden in tss.override.json) is the only knob —
// container name and host port are both derived from `${project}-${dev.worktree}`
// so multiple worktrees can run side-by-side without colliding.

export function localContainerName(cfg: TssConfig = loadConfig()): string {
  return `${namespace(cfg)}-ddb-local`;
}

export function localDdbPort(cfg: TssConfig = loadConfig()): number {
  return 30000 + portOffset(namespace(cfg));
}

export function localDdbEndpoint(cfg: TssConfig = loadConfig()): string {
  return `http://localhost:${localDdbPort(cfg)}`;
}
