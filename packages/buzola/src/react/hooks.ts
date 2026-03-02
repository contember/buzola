import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RouterContext, RouteContext } from './context';
import type { Router } from '../engine/router';
import type {
  NavigateOptions,
  RegisteredPath,
  RegisteredParams,
  RouterState,
  StandardSchema,
} from '../engine/types';

/**
 * Get the Router instance.
 */
export function useRouter(): Router {
  const router = use(RouterContext);
  if (!router) {
    throw new Error('useRouter must be used within a <BuzolaProvider>');
  }
  return router;
}

/**
 * Get the current route context.
 */
function useRouteContext() {
  const context = use(RouteContext);
  if (!context) {
    throw new Error('Route hooks must be used within a <BuzolaProvider>');
  }
  return context;
}

/**
 * Type-safe navigation function.
 * Infers param requirements from the path literal.
 */
type NavigateFn = <P extends RegisteredPath>(
  to: P,
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  ...args: {} extends RegisteredParams<P>
    ? [options?: NavigateOptions]
    : [options: NavigateOptions & { params: RegisteredParams<P> }]
) => void;

/**
 * Hook to get a type-safe navigate function.
 */
export function useNavigate(): NavigateFn {
  const router = useRouter();

  return useCallback(
    (to: string, options?: NavigateOptions & { params?: Record<string, string> }) => {
      const path = options?.params ? router.buildPath(to, options.params) : to;
      router.navigate(path, options);
    },
    [router],
  ) as NavigateFn;
}

/**
 * Hook to get typed route params.
 * Params are merged from all matched routes (root to current depth).
 */
export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  const context = useRouteContext();
  return context.params as T;
}

/**
 * Hook to get and validate search params.
 * Optionally validates with a Standard Schema compatible schema.
 */
export function useSearchParams<T = Record<string, string>>(
  schema?: StandardSchema<T>,
): T {
  const context = useRouteContext();

  return useMemo(() => {
    const searchParams = context.state.location.searchParams;
    const raw: Record<string, string[]> = {};
    searchParams.forEach((value, key) => {
      const existing = raw[key];
      if (existing) {
        existing.push(value);
      } else {
        raw[key] = [value];
      }
    });

    if (schema) {
      const result = schema['~standard'].validate(raw);
      if ('issues' in result) {
        throw new Error(
          `Search params validation failed: ${result.issues.map(i => i.message).join(', ')}`
        );
      }
      return result.value;
    }

    return raw as T;
  }, [context.state.location.searchParams, schema]);
}

/**
 * Hook to get information about the current route.
 */
export function useRoute() {
  const context = useRouteContext();
  const router = useRouter();
  const { state, matches, params, depth } = context;

  return useMemo(() => ({
    /** Current route's params. */
    params,
    /** All route matches from root to leaf. */
    matches,
    /** Current match depth. */
    depth,
    /** Whether a navigation is pending. */
    isPending: state.isPending,
    /** Current pathname (with base path stripped). */
    pathname: router.stripBasePath(state.location.pathname),
  }), [params, matches, depth, state.isPending, state.location.pathname, router]);
}

/**
 * Hook to get the Navigation API state for the current entry.
 */
export function useNavigationState<T = unknown>(): T | undefined {
  const context = useRouteContext();
  return context.state.navigationState as T | undefined;
}

/**
 * Hook to get the current RouterState.
 */
export function useRouterState(): RouterState {
  const context = useRouteContext();
  return context.state;
}

// ─── Blocker ─────────────────────────────────────────────────────────────────

export interface BlockerState {
  /** Whether a navigation is currently blocked. */
  state: 'idle' | 'blocked';
  /** Allow the blocked navigation to proceed. */
  proceed: () => void;
  /** Cancel the blocked navigation and stay on the current page. */
  reset: () => void;
}

/**
 * Hook to block navigations (e.g., to warn about unsaved changes).
 *
 * @param when - Whether blocking is active. Pass `true` to block, `false` to allow.
 * @returns An object with the blocker state and proceed/reset functions.
 *
 * @example
 * ```tsx
 * const blocker = useBlocker(formIsDirty);
 *
 * if (blocker.state === 'blocked') {
 *   return <Dialog onConfirm={blocker.proceed} onCancel={blocker.reset} />;
 * }
 * ```
 */
export function useBlocker(when: boolean): BlockerState {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'blocked'>('idle');
  const resolverRef = useRef<((proceed: boolean) => void) | null>(null);

  const blockerFn = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState('blocked');
    });
  }, []);

  useEffect(() => {
    if (!when) return;
    const cleanup = router.addBlocker(blockerFn);
    return () => {
      cleanup();
      // If there's a pending blocker when unmounting, auto-proceed
      if (resolverRef.current) {
        resolverRef.current(true);
        resolverRef.current = null;
      }
    };
  }, [router, when, blockerFn]);

  const proceed = useCallback(() => {
    resolverRef.current?.(true);
    resolverRef.current = null;
    setState('idle');
  }, []);

  const reset = useCallback(() => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setState('idle');
  }, []);

  return { state, proceed, reset };
}
