import { createPage, Link } from 'buzola'
import React from 'react'

export default createPage()
	.render(() => (
		<div>
			<h1>404</h1>
			<p>Page not found.</p>
			<Link to="index">Go home</Link>
		</div>
	))
