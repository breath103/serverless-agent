import { z } from "zod";

// Actual Skill handler.
// Skill has two aspect that is "optional". "configurable" and "installable"
export function defineSkill<
  TId extends string,
  TConfig,
  TEvent,
  TInstall
>(def: SkillHandler<TId, TConfig, TEvent, TInstall>) {
  return def;
}

/** @public — required for declaration emit */
export interface SkillHandler<
  TId extends string,
  TConfig,
  TEvent,
  TInstall
> {
  readonly id: TId;
  readonly displayName: string;
  readonly description: string;
  readonly configSchema: z.ZodType<TConfig>;
  readonly eventSchema: z.ZodType<TEvent>;
  readonly install: TInstall;
}
