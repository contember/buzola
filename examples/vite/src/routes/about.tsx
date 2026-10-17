import { createPage } from '@buzola/router'
import React from 'react'
import { LongContent } from '../components/long-content.js'

export default createPage()
	.route('/about')
	.render(() => (
		<div>
			<h1>About</h1>
			<p>Buzola is a modern SPA router built on the Navigation API.</p>
			<LongContent label="About" />
		</div>
	))
