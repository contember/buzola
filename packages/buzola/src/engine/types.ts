import type { ComponentType, LazyExoticComponent } from 'react'

// ─── Module augmentation interface ──────────────────────────────────────────

/**
 * Module augmentation point for type-safe page-centric routing.
 * Vite plugin generates declarations that extend this interface.
 * Maps page IDs to their params types.
 */
// biome-ignore lint/suspicious/noEmptyInterface: declaration merging
export interface BuzolaPageMap {}

/**
 * Module augmentation point for persistent parameters.
 * Vite plugin generates declarations that extend this interface.
 * Keys listed here are automatically carried over between navigations.
 */
// biome-ignore lint/suspicious/noEmptyInterface: declaration merging
export interface BuzolaPersistentParams {}

/**
 * Registered page IDs from BuzolaPageMap.
 */
export type RegisteredPage = keyof BuzolaPageMap & string

/**
 * Get the params type for a registered page.
 */
export type PageParams<P extends keyof BuzolaPageMap> = BuzolaPageMap[P]

/**
 * Effective params for a page — persistent params become optional.
 * When BuzolaPersistentParams is empty (default), collapses to BuzolaPageMap[P].
 */
export type EffectivePageParams<P extends keyof BuzolaPageMap> =
	& Omit<BuzolaPageMap[P], keyof BuzolaPersistentParams & string>
	& Partial<Pick<BuzolaPageMap[P], keyof BuzolaPersistentParams & string & keyof BuzolaPageMap[P]>>

// ─── Route configuration ────────────────────────────────────────────────────

/**
 * Standard Schema compatible interface (Zod 4, Valibot, ArkType).
 * See: https://github.com/standard-schema/standard-schema
 */
export interface StandardSchema<T = unknown> {
	'~standard': {
		version: 1
		vendor: string
		validate: (value: unknown) => { value: T } | { issues: readonly { message: string }[] }
	}
}

/** Route component — either a regular component or a lazy-loaded one. */
export type RouteComponent = ComponentType<Record<string, never>> | LazyExoticComponent<ComponentType<Record<string, never>>>

/** Configuration for a single route. */
export interface RouteConfig {
	/** The path segment for this route. */
	path: string
	/** Override the URL path for matching (absolute, not joined with parent). */
	matchPath?: string
	/** Component to render for this route. */
	component?: RouteComponent
	/** Schema for validating search params (Standard Schema compatible). */
	searchSchema?: StandardSchema
	/** Preload function — triggers lazy component import ahead of navigation. */
	preload?: () => void
	/** Child routes. */
	children?: RouteConfig[]
	/** Whether this is a layout route (has outlet but no own path segment). */
	isLayout?: boolean
	/** Whether this is an index route (renders at parent's exact path). */
	isIndex?: boolean
	/** Whether this is a pathless group (e.g., (auth) — no URL segment). */
	isPathlessGroup?: boolean
}

// ─── Route matching ─────────────────────────────────────────────────────────

/** A matched route with extracted params. */
export interface RouteMatch {
	/** The route node that matched. */
	node: RouteNode
	/** Extracted path parameters. */
	params: Record<string, string>
	/** The full URL pathname that was matched. */
	pathname: string
}

// ─── Route tree ─────────────────────────────────────────────────────────────

/** A node in a route match chain. Represents a layout or page with its component and metadata. */
export interface RouteNode {
	/** Unique ID for this node. */
	id: string
	/** The path segment pattern (e.g., "/users/:userId"). */
	path: string
	/** Full path from root (e.g., "/users/:userId"). */
	fullPath: string
	/** Component to render. */
	component?: RouteComponent
	/** Search params schema. */
	searchSchema?: StandardSchema
	/** Preload function — triggers lazy component import ahead of navigation. */
	preload?: () => void
	/** Whether this is a layout node (renders children via Outlet). */
	isLayout: boolean
	/** Whether this is an index route. */
	isIndex: boolean
}

// ─── Route trie ─────────────────────────────────────────────────────────────

/** A node in the segment trie used for URL matching. */
export interface TrieNode {
	/** Static children — exact segment match via Map lookup (O(1)). */
	staticChildren: Map<string, TrieNode>
	/** Dynamic child — matches any single segment as a named param. */
	dynamicChild?: { paramName: string; node: TrieNode }
	/** Catch-all child — matches all remaining segments. */
	catchAllChild?: { paramName: string; chain: RouteNode[] }
	/** When defined, a route terminates at this trie node. */
	route?: TrieRoute
}

/** A terminal route in the trie, containing the layout chain from root to leaf. */
export interface TrieRoute {
	/** Match chain: array of RouteNode from root layout to leaf page. */
	chain: RouteNode[]
}

/** Opaque route tree built from RouteConfig[]. Passed to matchRoutes() and Router. */
export interface RouteTree {
	/** @internal Root of the segment trie. */
	root: TrieNode
}

// ─── Router state ───────────────────────────────────────────────────────────

/** The current state of the router. */
export interface RouterState {
	/** Current URL location. */
	location: URL
	/** Array of matched routes from root to leaf. */
	matches: RouteMatch[]
	/** Whether a navigation is in progress. */
	isPending: boolean
	/** The target URL during a pending navigation. Undefined when not navigating. */
	pendingLocation?: URL
	/** Navigation state from Navigation API. */
	navigationState?: unknown
}

// ─── Navigation adapter ─────────────────────────────────────────────────────

/** Options for programmatic navigation. */
export interface NavigateOptions {
	/** Replace the current history entry instead of pushing. */
	replace?: boolean
	/** State to associate with the navigation entry. */
	state?: unknown
	/** Use View Transitions API for the navigation. */
	viewTransition?: boolean
	/**
	 * Whether to reset scroll position after navigation.
	 * Default is `true` (browser handles it: scroll to top on push, restore on traverse).
	 * Set to `false` to preserve current scroll position.
	 */
	resetScroll?: boolean
}

/**
 * Blocker function registered with the router.
 * Called when a navigation is about to happen.
 * Must return a Promise that resolves to `true` to allow navigation, `false` to block.
 */
export type BlockerFn = () => Promise<boolean>

/** Navigate event from the Navigation API (simplified). */
export interface BuzolaNavigateEvent {
	/** The destination URL. */
	destination: { url: string }
	/** Whether the navigation can be intercepted. */
	canIntercept: boolean
	/** The type of navigation. */
	navigationType: 'push' | 'replace' | 'reload' | 'traverse'
	/** Whether the user initiated the navigation (e.g., clicking a link). */
	userInitiated: boolean
	/** Whether this navigation should use View Transitions API. */
	viewTransition?: boolean
	/** Intercept the navigation and handle it client-side. */
	intercept(options: { handler: () => Promise<void>; scroll?: 'after-transition' | 'manual' }): void
}

/** Abstraction over the Navigation API for testability. */
export interface NavigationAdapter {
	/** Get the current URL. */
	getCurrentURL(): URL
	/** Navigate to a URL. */
	navigate(url: string, options?: NavigateOptions): void
	/** Go back. */
	back(): void
	/** Go forward. */
	forward(): void
	/** Add a navigate event listener. */
	addEventListener(type: 'navigate', handler: (event: BuzolaNavigateEvent) => void): void
	/** Remove a navigate event listener. */
	removeEventListener(type: 'navigate', handler: (event: BuzolaNavigateEvent) => void): void
	/** Get the current navigation state. */
	getState(): unknown
}
