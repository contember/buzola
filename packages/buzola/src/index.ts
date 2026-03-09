// ─── Engine ─────────────────────────────────────────────────────────────────
export { LoaderCache } from './engine/loader-cache'

export { NavigationAbortedError, Router } from './engine/router'
export type { RouterOptions, RouterSubscriber } from './engine/router'

export { buildRouteTree, createRouteNode } from './engine/route-tree'
export type { CreateRouteNodeOptions } from './engine/route-tree'

export { matchRoutes } from './engine/matcher'

export { createBrowserNavigationAdapter, createMemoryNavigationAdapter } from './engine/navigation-adapter'
export type { MemoryNavigationAdapterOptions } from './engine/navigation-adapter'

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
	BlockerFn,
	BuzolaNavigateEvent,
	BuzolaPageMap,
	BuzolaPersistentParams,
	EffectivePageParams,
	GuardContext,
	GuardRedirect,
	NavigateOptions,
	NavigationAdapter,
	PageParams,
	RegisteredPage,
	RouteComponent,
	RouteConfig,
	RouteGuard,
	RouteGuardResult,
	RouteMatch,
	RouteNode,
	RouterState,
	StandardSchema,
} from './engine/types'

// ─── Schema ──────────────────────────────────────────────────────────────────
export { s } from './engine/schema'

// ─── Route definition ───────────────────────────────────────────────────────
export { createPage } from './define/create-page'
export type { CatchContext, PageDefinition, PageProps } from './define/create-page'

// ─── React (re-export from subpath) ─────────────────────────────────────────
export {
	BuzolaProvider,
	ErrorBoundary,
	Link,
	Outlet,
	RouteContext,
	RouterContext,
	useBlocker,
	useInvalidate,
	useNavigate,
	useNavigationState,
	useParams,
	useRoute,
	useRouter,
	useRouterState,
	useSearchParams,
} from './react/index'
export type { BlockerState, BuzolaProviderProps, LinkProps, OutletProps, RouteContextValue } from './react/index'
