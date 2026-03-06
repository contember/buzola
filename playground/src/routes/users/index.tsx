import { createPage, Link } from 'buzola'
import React from 'react'

export default createPage()
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
