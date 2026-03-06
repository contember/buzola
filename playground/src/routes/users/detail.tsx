import { createPage, Link, s, useRoute } from 'buzola'
import React from 'react'

export default createPage()
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
