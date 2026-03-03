import React, { useCallback } from 'react'
import type { EffectiveParams, NavigateOptions, RegisteredPath } from '../engine/types.js'
import { useRouter, useRouterState } from './hooks.js'

// ─── Link props type — always type-safe via template literal inference ───────

type LinkPropsBase = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
	/** Replace the current history entry instead of pushing. */
	replace?: boolean
	/** State to associate with the navigation entry. */
	state?: unknown
	/** Use View Transitions API for this navigation. */
	viewTransition?: boolean
	/**
	 * Whether to reset scroll position after navigation.
	 * Default is `true`. Set to `false` to preserve current scroll position.
	 */
	resetScroll?: boolean
	/**
	 * Use exact matching for active detection.
	 * When `true` (default), `data-active` is set only when the current path equals the link target.
	 * When `false`, `data-active` is also set when the current path starts with the link target.
	 */
	activeExact?: boolean
}

export type LinkProps<P extends RegisteredPath = RegisteredPath> = [keyof EffectiveParams<P>] extends [never]
	? LinkPropsBase & { to: P; params?: never }
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	: {} extends EffectiveParams<P> ? LinkPropsBase & { to: P; params?: EffectiveParams<P> }
	: LinkPropsBase & { to: P; params: EffectiveParams<P> }

/**
 * Type-safe link component.
 * For simple navigations, renders a native <a> and lets the Navigation API handle it.
 * Uses programmatic navigation when state, replace, resetScroll, or viewTransition is needed.
 *
 * Sets `data-active` attribute when the link target matches the current URL.
 */
export function Link<P extends RegisteredPath>(props: LinkProps<P>): React.ReactElement {
	const {
		to,
		params,
		replace,
		state,
		viewTransition,
		resetScroll,
		activeExact = true,
		onClick,
		children,
		...rest
	} = props as LinkPropsBase & { to: string; params?: Record<string, string> }

	const router = useRouter()
	const routerState = useRouterState()

	const resolvedParams = router.resolveParams(to, params)
	const href = router.buildPath(to, resolvedParams)
	const needsProgrammaticNav = state !== undefined || replace || viewTransition || resetScroll === false

	// Active detection: compare route paths (without basePath)
	const currentPath = router.stripBasePath(routerState.location.pathname)
	const targetPath = router.stripBasePath(href)
	const isExact = currentPath === targetPath
	const isPrefix = targetPath !== '/' && currentPath.startsWith(targetPath + '/')
	const isActive = isExact || (!activeExact && isPrefix)

	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLAnchorElement>) => {
			onClick?.(e)
			if (e.defaultPrevented) return

			// Only handle left clicks without modifier keys
			if (e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return

			if (needsProgrammaticNav) {
				e.preventDefault()
				router.navigate(
					router.stripBasePath(href),
					{ replace, state, viewTransition, resetScroll } as NavigateOptions,
				)
			}
			// Otherwise, let the native <a> click through — Navigation API will intercept it
		},
		[onClick, needsProgrammaticNav, router, href, replace, state, viewTransition, resetScroll],
	)

	return (
		<a href={href} onClick={handleClick} data-active={isActive ? '' : undefined} {...rest}>
			{children}
		</a>
	)
}
