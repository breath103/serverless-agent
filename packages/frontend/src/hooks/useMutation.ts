import { useCallback, useEffect, useMemo, useState } from "react";

type MutationState<TResult> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: TResult }
  | { status: "error"; error: Error };

// eslint-disable-next-line @typescript-eslint/no-restricted-types
type MutationResult<TParams extends unknown[], TResult> = {
  call: (...params: TParams) => Promise<TResult | null>;
  reset: () => void;
} & MutationState<TResult>;

// eslint-disable-next-line @typescript-eslint/no-restricted-types
export function useMutation<TParams extends unknown[], TResult>(
  fn: (...params: TParams) => Promise<TResult>,
  deps: React.DependencyList
): MutationResult<TParams, TResult> {
  const [state, setState] = useState<MutationState<TResult>>({ status: "idle" });

  // Reset when deps change
  useEffect(() => {
    setState({ status: "idle" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const call = useCallback(
    async (...params: TParams): Promise<TResult | null> => {
      setState({ status: "loading" });
      try {
        const result = await fn(...params);
        setState({ status: "success", result });
        return result;
      } catch (e) {
        setState({ status: "error", error: e as Error });
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return useMemo(() => ({ call, reset, ...state }), [call, reset, state]);
}
