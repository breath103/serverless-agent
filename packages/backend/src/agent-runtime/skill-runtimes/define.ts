import { z } from "zod";

import { mapValues } from "../../lib/object.js";
import type { SkillConfigMap, SkillId } from "../../skills/index.js";

// ── Public types ────────────────────────────────────────────────────────────

interface SkillMethodDef {
  params?: z.ZodType;
  returns?: z.ZodType;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type SkillRuntimeInstance<TMethods extends Record<string, SkillMethodDef> = {}> = {
  instanceId: string;
  skillId: string;
  variableName: string;
  variableDescription: string;
} & InferMethods<TMethods>;

type InferMethods<T extends Record<string, SkillMethodDef>> = {
  [K in keyof T]: T[K] extends { params: infer P extends z.ZodType; returns: infer R extends z.ZodType }
    ? (params: z.infer<P>) => Promise<z.infer<R>>
    : T[K] extends { params: infer P extends z.ZodType }
      ? (params: z.infer<P>) => Promise<void>
      : () => Promise<void>;
};

/** @public — required for declaration emit */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SkillFactory<TSkillId extends SkillId, RuntimeOptions, TMethods extends Record<string, SkillMethodDef> = {}> {
  create(instanceId: string, config: SkillConfigMap[TSkillId], opts: RuntimeOptions): SkillRuntimeInstance<TMethods>;
  readonly id: TSkillId;
  readonly instanceDescription: (config: SkillConfigMap[TSkillId]) => string;
  readonly definition: {
    entities: Record<string, z.ZodType>;
    methods: Record<string, { params?: z.ZodType; returns?: z.ZodType }>;
  };
  /** Type-only. Use `typeof skill.$infer.methods` to extract typed method signatures. */
  readonly $infer: { methods: InferMethods<TMethods> };
}

// ── Method helper ───────────────────────────────────────────────────────────

/** @public — required for declaration emit */
export interface MethodDefWithHandler extends SkillMethodDef {
  // eslint-disable-next-line @typescript-eslint/no-restricted-types
  handler: (...args: never[]) => Promise<unknown>;
}

interface DefineMethod<TCtx> {
  <TParams extends z.ZodType, TReturns extends z.ZodType>(def: {
    params: TParams;
    returns: TReturns;
    // eslint-disable-next-line @typescript-eslint/no-restricted-types
    handler: (ctx: TCtx, params: z.infer<TParams>) => Promise<unknown>;
  }): MethodDefWithHandler & { params: TParams; returns: TReturns };

  <TParams extends z.ZodType>(def: {
    params: TParams;
    // eslint-disable-next-line @typescript-eslint/no-restricted-types
    handler: (ctx: TCtx, params: z.infer<TParams>) => Promise<unknown>;
  }): MethodDefWithHandler & { params: TParams };

  (def: {
    returns?: z.ZodType;
    // eslint-disable-next-line @typescript-eslint/no-restricted-types
    handler: (ctx: TCtx) => Promise<unknown>;
  }): MethodDefWithHandler;
}

// ── defineSkillRuntime() ────────────────────────────────────────────────────
interface SkillDefinition {
  entities: Record<string, z.ZodType>;
  methods: Record<string, { params?: z.ZodType; returns?: z.ZodType }>;
}

export function skillNamespace({ skillId }: { skillId: string }) {
  return skillId.replace(/(^|-)([a-z])/g, (_, _sep, c: string) => c.toUpperCase());
}

export function defineSkillRuntime<TSkillId extends SkillId, TCtx, TMethods extends Record<string, MethodDefWithHandler>, RuntimeOptions = undefined>(
  skillId: TSkillId,
  def: {
    create: (instanceId: string, config: SkillConfigMap[TSkillId], opts: RuntimeOptions) => TCtx;
    instanceDescription: (config: SkillConfigMap[TSkillId]) => string;
    entities?: Record<string, z.ZodType>;
    methods: (m: DefineMethod<TCtx>) => TMethods;
  },
): SkillFactory<TSkillId, RuntimeOptions, TMethods> {
  // m is identity at runtime — its only purpose is type-level inference
  const m = ((d: MethodDefWithHandler) => d) as DefineMethod<TCtx>;
  const methodDefs = def.methods(m);

  return {
    create: (instanceId, config, opts) => {
      const ctx = def.create(instanceId, config, opts);
      return {
        skillId,
        instanceId,
        variableName: "",
        variableDescription: def.instanceDescription(config),

        // Methods can't be safely typed - but rest is
        ...mapValues(methodDefs, (method) => {
          return (params: never) => method.handler(ctx as never, (method.params ? method.params.parse(params) : params) as never);
        }) as InferMethods<TMethods>,
      } satisfies SkillRuntimeInstance<TMethods>;
    },
    id: skillId,
    instanceDescription: def.instanceDescription,
    definition: {
      entities: def.entities ?? {},
      methods: mapValues(methodDefs, ({ params, returns }) => ({ params, returns })) as SkillDefinition["methods"],
    } satisfies SkillDefinition,

    // eslint-disable-next-line @typescript-eslint/no-restricted-types
    $infer: undefined as unknown as SkillFactory<TSkillId, RuntimeOptions, TMethods>["$infer"],
  };
}
