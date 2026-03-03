import { createContext } from 'react'
import type { Router } from '../engine/router'
import type { RouteMatch, RouterState } from '../engine/types'

/**
 * Context providing the Router instance.
 */
export const RouterContext = createContext<Router | null>(null)

/**
 * Context for the current route matching state.
 */
export interface RouteContextValue {
	/** Current router state. */
	state: RouterState
	/** Current depth in the route match chain. */
	depth: number
	/** All matches from root to leaf. */
	matches: RouteMatch[]
	/** Merged params from root to current depth. */
	params: Record<string, string>
}

export const RouteContext = createContext<RouteContextValue | null>(null)
