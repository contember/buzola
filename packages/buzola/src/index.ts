// ─── Engine ─────────────────────────────────────────────────────────────────
export { Router, NavigationAbortedError } from './engine/router';
export type { RouterOptions, RouterSubscriber } from './engine/router';

export { buildRouteTree, createRouteNode } from './engine/route-tree';
export type { CreateRouteNodeOptions } from './engine/route-tree';

export { matchRoutes } from './engine/matcher';

export {
  createBrowserNavigationAdapter,
  createMemoryNavigationAdapter,
} from './engine/navigation-adapter';
export type { MemoryNavigationAdapterOptions } from './engine/navigation-adapter';

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  ParamsForPath,
  BuzolaRouteMap,
  RegisteredPath,
  RegisteredParams,
  StandardSchema,
  GuardContext,
  GuardRedirect,
  RouteGuardResult,
  RouteGuard,
  RouteComponent,
  RouteConfig,
  RouteMatch,
  RouteNode,
  RouterState,
  NavigateOptions,
  NavigationAdapter,
  BuzolaNavigateEvent,
  BlockerFn,
} from './engine/types';

// ─── Route definition ───────────────────────────────────────────────────────
export { defineRoutes, defineRoute } from './define/define-routes';
export type { DefineRouteOptions, RouteDefinitionOptions, RouteBuilderFn } from './define/define-routes';

// ─── React (re-export from subpath) ─────────────────────────────────────────
export {
  BuzolaProvider,
  Outlet,
  Link,
  ErrorBoundary,
  useRouter,
  useNavigate,
  useParams,
  useSearchParams,
  useRoute,
  useNavigationState,
  useRouterState,
  useBlocker,
  RouterContext,
  RouteContext,
} from './react/index';
export type {
  BuzolaProviderProps,
  OutletProps,
  LinkProps,
  BlockerState,
  RouteContextValue,
} from './react/index';
