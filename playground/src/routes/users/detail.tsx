import { createPage, Link, useRoute } from 'buzola'
import React from 'react'

const mockUsers: Record<string, { name: string; email: string }> = {
	'1': { name: 'Alice', email: 'alice@example.com' },
	'2': { name: 'Bob', email: 'bob@example.com' },
	'3': { name: 'Charlie', email: 'charlie@example.com' },
}

const mockPosts: Record<string, string[]> = {
	'1': ['Hello World', 'My Second Post'],
	'2': ['Bob writes code'],
	'3': [],
}

export default createPage()
	.params({ userId: 'string', tab: '?string' })
	.loader(async ({ params }) => {
		await new Promise(r => setTimeout(r, 300))
		const user = mockUsers[params.userId]
		if (!user) throw new Error(`User ${params.userId} not found`)
		return { user, lastSeen: new Date().toLocaleTimeString() }
	})
	.loader(async ({ params }) => {
		await new Promise(r => setTimeout(r, 200))
		const posts = mockPosts[params.userId] ?? []
		return { posts, randomScore: Math.round(Math.random() * 100) }
	})
	.route('/users/:userId')
	.render(({ params, data, invalidate, isLoading }) => {
		const route = useRoute()
		return (
			<div>
				<h2>
					{data.user.name} {isLoading && <span style={{ fontSize: '0.7em', color: '#888' }}>refreshing…</span>}
				</h2>
				<div className="params">
					<p>email: {data.user.email}</p>
					<p>posts: {data.posts.length}</p>
					<p>score: {data.randomScore}</p>
					<p>last seen: {data.lastSeen}</p>
					<p>tab: {params.tab ?? <em>none</em>}</p>
					<p>pathname: {route.pathname}</p>
				</div>
				<ul>
					{data.posts.map((post, i) => <li key={i}>{post}</li>)}
				</ul>
				<div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
					<button onClick={invalidate}>Reload data</button>
					<Link to="users/settings" params={{ userId: params.userId }}>Settings</Link>
					<Link to="users/detail" params={{ userId: params.userId, tab: 'posts' }}>Posts tab</Link>
					<Link to="users/detail" params={{ userId: params.userId, tab: 'activity' }}>Activity tab</Link>
				</div>
			</div>
		)
	})
