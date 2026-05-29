import { createPage } from '@buzola/router'
import React from 'react'

export default createPage()
	.route('/')
	.render(() => (
		<div>
			<h1>Home</h1>
			<p>Welcome to the Buzola example! This app demonstrates page-centric routing.</p>
		</div>
	))
