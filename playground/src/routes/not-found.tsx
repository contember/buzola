import { createPage, Link, s } from 'buzola'
import React from 'react'

export default createPage()
	.params(s.object({ path: s.string() }))
	.route('/:path+')
	.render(() => (
		<div>
			<h1>404</h1>
			<p>Page not found.</p>
			<Link to="index">Go home</Link>
		</div>
	))
