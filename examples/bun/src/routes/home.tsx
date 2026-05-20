import { createPage } from '@buzola/router'
import React from 'react'

export default createPage()
	.route('/')
	.render(() => (
		<div>
			<h1>Home</h1>
			<p>Welcome to Buzola playground! This app demonstrates page-centric routing.</p>
		</div>
	))
