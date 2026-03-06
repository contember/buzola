import { buildRouteTree, BuzolaProvider, createPage, Link, Outlet, s, useNavigate, useRoute } from 'buzola'
import type { RouteConfig } from 'buzola'
import React from 'react'

// ─── Page definitions ────────────────────────────────────────────────────────

export function RootLayout() {
	return (
		<div>
			<nav>
				<Link to="home">Home</Link>
				<Link to="about">About</Link>
				<Link to="users/list">Users</Link>
				<Link to="users/detail" params={{ userId: '1' }}>User 1</Link>
				<Link to="users/detail" params={{ userId: '2' }}>User 2</Link>
				<Link to="users/settings" params={{ userId: '1' }}>User 1 Settings</Link>
			</nav>
			<main>
				<Outlet />
			</main>
		</div>
	)
}

export const home = createPage()
	.route('/')
	.render(() => (
		<div>
			<h1>Home</h1>
			<p>Welcome to Buzola playground! This app demonstrates page-centric routing.</p>
		</div>
	))

export const about = createPage()
	.route('/about')
	.render(() => (
		<div>
			<h1>About</h1>
			<p>Buzola is a modern SPA router built on the Navigation API.</p>
		</div>
	))

export function UsersLayout() {
	return (
		<div>
			<h1>Users</h1>
			<Outlet />
		</div>
	)
}

export const usersList = createPage()
	.route('/users')
	.render(() => (
		<div>
			<h2>All Users</h2>
			<ul>
				<li>
					<Link to="users/detail" params={{ userId: '1' }}>Alice (ID: 1)</Link>
				</li>
				<li>
					<Link to="users/detail" params={{ userId: '2' }}>Bob (ID: 2)</Link>
				</li>
				<li>
					<Link to="users/detail" params={{ userId: '3' }}>Charlie (ID: 3)</Link>
				</li>
			</ul>
		</div>
	))

export const userDetail = createPage()
	.params(s.object({ userId: s.string(), tab: s.optional(s.string()) }))
	.route('/users/:userId')
	.render(({ params }) => {
		const route = useRoute()
		return (
			<div>
				<h2>User Detail</h2>
				<div className="params">
					<p>userId: {params.userId}</p>
					<p>tab: {params.tab ?? <em>none</em>}</p>
					<p>pathname: {route.pathname}</p>
				</div>
				<div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
					<Link to="users/settings" params={{ userId: params.userId }}>Settings</Link>
					<Link to="users/detail" params={{ userId: params.userId, tab: 'posts' }}>Posts tab</Link>
					<Link to="users/detail" params={{ userId: params.userId, tab: 'activity' }}>Activity tab</Link>
				</div>
			</div>
		)
	})

export const userSettings = createPage()
	.params(s.object({ userId: s.string() }))
	.route('/users/:userId/settings')
	.render(({ params }) => {
		const navigate = useNavigate()
		return (
			<div>
				<h2>User Settings</h2>
				<div className="params">
					<p>userId: {params.userId}</p>
				</div>
				<p style={{ marginTop: '1rem' }}>
					<button onClick={() => navigate('users/detail', { params: { userId: params.userId } })}>
						Back to profile
					</button>
				</p>
			</div>
		)
	})

export function NotFound() {
	return (
		<div>
			<h1>404</h1>
			<p>Page not found.</p>
			<Link to="home">Go home</Link>
		</div>
	)
}

// ─── Module augmentation for playground (manual, since no Vite plugin) ───────

declare module 'buzola' {
	interface BuzolaPageMap {
		'home': {}
		'about': {}
		'users/list': {}
		'users/detail': { userId: string; tab?: string }
		'users/settings': { userId: string }
		'notFound': { path: string }
	}
}

// ─── Page registry ──────────────────────────────────────────────────────────

const pageRegistry: Record<string, string> = {
	'home': '/',
	'about': '/about',
	'users/list': '/users',
	'users/detail': '/users/:userId',
	'users/settings': '/users/:userId/settings',
	'notFound': '/:path+',
}

// ─── Route tree (manual config) ─────────────────────────────────────────────

const routeConfigs: RouteConfig[] = [
	{
		path: '/',
		component: RootLayout,
		isLayout: true,
		children: [
			{ path: '/', component: home.component, isIndex: true },
			{ path: '/about', component: about.component },
			{
				path: '/users',
				component: UsersLayout,
				isLayout: true,
				children: [
					{ path: '/', component: usersList.component, isIndex: true },
					{ path: '/:userId', component: userDetail.component },
					{ path: '/:userId/settings', component: userSettings.component },
				],
			},
			{ path: '/:path+', component: NotFound },
		],
	},
]

const routes = buildRouteTree(routeConfigs)

// ─── App ────────────────────────────────────────────────────────────────────

export function App() {
	return <BuzolaProvider routes={routes} pageRegistry={pageRegistry} />
}
