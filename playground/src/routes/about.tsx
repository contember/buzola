import { createPage } from 'buzola'
import React from 'react'

export default createPage()
	.route('/about')
	.render(() => (
		<div>
			<h1>About</h1>
			<p>Buzola is a modern SPA router built on the Navigation API.</p>
		</div>
	))
