import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncData<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export function toErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export type AsyncDataResult<T> =
  | { status: "loading"; reload: () => void }
  | { status: "error"; message: string; reload: () => void }
  | { status: "ready"; data: T; reload: () => void };

/**
 * Declarative data fetching: runs the fetcher on mount, when `deps` change,
 * or when `reload()` is called. All state updates happen from the promise
 * callbacks, never synchronously inside the effect.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[] = [],
): AsyncDataResult<T> {
  const [state, setState] = useState<AsyncData<T>>({ status: "loading" });
  const [generation, setGeneration] = useState(0);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let cancelled = false;
    fetcherRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: toErrorMessage(err) });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, ...deps]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setGeneration((g) => g + 1);
  }, []);

  return state.status === "ready"
    ? { status: "ready", data: state.data, reload }
    : state.status === "error"
      ? { status: "error", message: state.message, reload }
      : { status: "loading", reload };
}
