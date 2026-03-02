import React, { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Router } from '../engine/router.js';
import { RouterContext, RouteContext, type RouteContextValue } from './context.js';
import { Outlet } from './outlet.js';

export interface BuzolaProviderProps {
  router: Router;
  children?: React.ReactNode;
}

/**
 * Root provider for Buzola router.
 * Subscribes to router state and provides context to the React tree.
 */
export function BuzolaProvider({ router, children }: BuzolaProviderProps): React.ReactElement {
  const subscribe = useCallback((cb: () => void) => router.subscribe(cb), [router]);
  const getSnapshot = useCallback(() => router.getState(), [router]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Start navigation interception
  useEffect(() => {
    return router.start();
  }, [router]);

  const routeContextValue = useMemo<RouteContextValue>(() => ({
    state,
    depth: 0,
    matches: state.matches,
    params: {},
  }), [state]);

  return (
    <RouterContext value={router}>
      <RouteContext value={routeContextValue}>
        {children ?? <Outlet />}
      </RouteContext>
    </RouterContext>
  );
}
