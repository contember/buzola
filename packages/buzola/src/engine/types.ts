import type { ComponentType, LazyExoticComponent } from 'react';

// ─── Template literal type extraction ───────────────────────────────────────

/**
 * Extract dynamic parameter names from a route path pattern.
 * "/users/:userId/posts/:postId" → "userId" | "postId"
 */
type ExtractParamNames<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParamNames<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never;

/**
 * Extract params object type from a route path.
 * ParamsForPath<"/users/:userId"> = { userId: string }
 * ParamsForPath<"/about"> = {}
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ParamsForPath<T extends string> =
  [ExtractParamNames<T>] extends [never]
    ? {}
    : Record<ExtractParamNames<T>, string>;

// ─── Module augmentation interface ──────────────────────────────────────────

/**
 * Module augmentation point for type-safe routing.
 * Vite plugin generates declarations that extend this interface.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BuzolaRouteMap {}

/**
 * Registered route paths from BuzolaRouteMap.
 */
export type RegisteredPath = keyof BuzolaRouteMap & string;

/**
 * Get the params type for a registered path.
 */
export type RegisteredParams<P extends keyof BuzolaRouteMap> = BuzolaRouteMap[P];

// ─── Route configuration ────────────────────────────────────────────────────

/**
 * Standard Schema compatible interface (Zod 4, Valibot, ArkType).
 * See: https://github.com/standard-schema/standard-schema
 */
export interface StandardSchema<T = unknown> {
  '~standard': {
    version: 1;
    vendor: string;
    validate: (value: unknown) => { value: T } | { issues: readonly { message: string }[] };
  };
}

/** Result returned by a route guard to redirect navigation. */
export interface GuardRedirect {
  redirect: string;
}

/** Context passed to route guards. */
export interface GuardContext {
  signal: AbortSignal;
}

/** Guard function — return false to block, a GuardRedirect to redirect, or true/void to allow. */
export type RouteGuardResult = boolean | void | GuardRedirect;
export type RouteGuard = (match: RouteMatch, context: GuardContext) => RouteGuardResult | Promise<RouteGuardResult>;

/** Route component — either a regular component or a lazy-loaded one. */
export type RouteComponent = ComponentType<Record<string, never>> | LazyExoticComponent<ComponentType<Record<string, never>>>;

/** Configuration for a single route. */
export interface RouteConfig {
  /** The path segment for this route. */
  path: string;
  /** Component to render for this route. */
  component?: RouteComponent;
  /** Schema for validating search params (Standard Schema compatible). */
  searchSchema?: StandardSchema;
  /** Guard function called before entering this route. */
  beforeEnter?: RouteGuard;
  /** Child routes. */
  children?: RouteConfig[];
  /** Whether this is a layout route (has outlet but no own path segment). */
  isLayout?: boolean;
  /** Whether this is an index route (renders at parent's exact path). */
  isIndex?: boolean;
  /** Whether this is a pathless group (e.g., (auth) — no URL segment). */
  isPathlessGroup?: boolean;
}

// ─── Route matching ─────────────────────────────────────────────────────────

/** A matched route with extracted params. */
export interface RouteMatch {
  /** The route node that matched. */
  node: RouteNode;
  /** Extracted path parameters. */
  params: Record<string, string>;
  /** The full URL pathname that was matched. */
  pathname: string;
}

// ─── Route tree ─────────────────────────────────────────────────────────────

/** A node in the route tree. */
export interface RouteNode {
  /** Unique ID for this node. */
  id: string;
  /** The path segment pattern (e.g., "/users/:userId"). */
  path: string;
  /** Full path from root (e.g., "/users/:userId"). */
  fullPath: string;
  /** Compiled URLPattern for matching (leaf/index routes). */
  pattern?: URLPattern;
  /** Compiled prefix URLPattern for param extraction (layout routes). */
  prefixPattern?: URLPattern;
  /** Component to render. */
  component?: RouteComponent;
  /** Search params schema. */
  searchSchema?: StandardSchema;
  /** Route guard. */
  beforeEnter?: RouteGuard;
  /** Child nodes. */
  children: RouteNode[];
  /** Parent node reference. */
  parent?: RouteNode;
  /** Whether this is a layout node (renders children via Outlet). */
  isLayout: boolean;
  /** Whether this is an index route. */
  isIndex: boolean;
}

// ─── Router state ───────────────────────────────────────────────────────────

/** The current state of the router. */
export interface RouterState {
  /** Current URL location. */
  location: URL;
  /** Array of matched routes from root to leaf. */
  matches: RouteMatch[];
  /** Whether a navigation is in progress. */
  isPending: boolean;
  /** Navigation state from Navigation API. */
  navigationState?: unknown;
}

// ─── Navigation adapter ─────────────────────────────────────────────────────

/** Options for programmatic navigation. */
export interface NavigateOptions {
  /** Replace the current history entry instead of pushing. */
  replace?: boolean;
  /** State to associate with the navigation entry. */
  state?: unknown;
  /** Use View Transitions API for the navigation. */
  viewTransition?: boolean;
  /**
   * Whether to reset scroll position after navigation.
   * Default is `true` (browser handles it: scroll to top on push, restore on traverse).
   * Set to `false` to preserve current scroll position.
   */
  resetScroll?: boolean;
}

/**
 * Blocker function registered with the router.
 * Called when a navigation is about to happen.
 * Must return a Promise that resolves to `true` to allow navigation, `false` to block.
 */
export type BlockerFn = () => Promise<boolean>;

/** Navigate event from the Navigation API (simplified). */
export interface BuzolaNavigateEvent {
  /** The destination URL. */
  destination: { url: string };
  /** Whether the navigation can be intercepted. */
  canIntercept: boolean;
  /** The type of navigation. */
  navigationType: 'push' | 'replace' | 'reload' | 'traverse';
  /** Whether the user initiated the navigation (e.g., clicking a link). */
  userInitiated: boolean;
  /** Whether this navigation should use View Transitions API. */
  viewTransition?: boolean;
  /** Intercept the navigation and handle it client-side. */
  intercept(options: { handler: () => Promise<void>; scroll?: 'after-transition' | 'manual' }): void;
}

/** Abstraction over the Navigation API for testability. */
export interface NavigationAdapter {
  /** Get the current URL. */
  getCurrentURL(): URL;
  /** Navigate to a URL. */
  navigate(url: string, options?: NavigateOptions): void;
  /** Go back. */
  back(): void;
  /** Go forward. */
  forward(): void;
  /** Add a navigate event listener. */
  addEventListener(type: 'navigate', handler: (event: BuzolaNavigateEvent) => void): void;
  /** Remove a navigate event listener. */
  removeEventListener(type: 'navigate', handler: (event: BuzolaNavigateEvent) => void): void;
  /** Get the current navigation state. */
  getState(): unknown;
}
