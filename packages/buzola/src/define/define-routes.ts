import type { RouteComponent, RouteConfig, RouteGuard, RouteNode, StandardSchema } from '../engine/types';
import { buildRouteTree } from '../engine/route-tree';

// ─── defineRoute — per-route config exported from route files ───────────────

export interface DefineRouteOptions {
  /** Schema for validating search params. */
  searchSchema?: StandardSchema;
  /** Guard function called before entering this route. */
  beforeEnter?: RouteGuard;
}

/**
 * Define route-level configuration for a route file.
 * Used in file-based routing: `export const route = defineRoute({ ... })`.
 */
export function defineRoute(options: DefineRouteOptions): DefineRouteOptions {
  return options;
}

function isRouteComponent(value: RouteDefinitionOptions | RouteComponent): value is RouteComponent {
  if (typeof value === 'function') return true;
  // Check for known option keys to distinguish from component objects (e.g. React.lazy)
  if (typeof value === 'object' && value !== null) {
    return !('component' in value || 'searchSchema' in value || 'beforeEnter' in value);
  }
  return false;
}

// ─── defineRoutes — declarative config-based route builder ──────────────────

export interface RouteDefinitionOptions {
  component?: RouteComponent;
  searchSchema?: StandardSchema;
  beforeEnter?: RouteGuard;
}

export type RouteBuilderFn = (
  route: (
    path: string,
    options: RouteDefinitionOptions | RouteComponent,
    children?: RouteConfig[],
  ) => RouteConfig,
) => RouteConfig[];

/**
 * Declarative route definition builder.
 *
 * @example
 * ```ts
 * const routeTree = defineRoutes(route => [
 *   route('/', { component: Home }),
 *   route('/users', { component: UsersLayout }, [
 *     route('/', { component: UsersList }),
 *     route('/:userId', { component: UserDetail }),
 *   ]),
 * ]);
 * ```
 */
export function defineRoutes(builder: RouteBuilderFn): RouteNode[] {
  function route(
    path: string,
    options: RouteDefinitionOptions | RouteComponent,
    children?: RouteConfig[],
  ): RouteConfig {
    // If options is a component directly (function or lazy), wrap it
    const opts: RouteDefinitionOptions = isRouteComponent(options)
      ? { component: options }
      : options;

    const isIndex = path === '/' || path === '';
    const hasChildren = children != null && children.length > 0;

    return {
      path,
      component: opts.component,
      searchSchema: opts.searchSchema,
      beforeEnter: opts.beforeEnter,
      children,
      isIndex: isIndex && !hasChildren,
      isLayout: hasChildren,
    };
  }

  const configs = builder(route);
  return buildRouteTree(configs);
}
