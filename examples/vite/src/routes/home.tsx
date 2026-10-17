import { createPage } from '@buzola/router'
import React from 'react'
import { LongContent } from '../components/long-content.js'

export default createPage()
	.route('/')
	.render(() => (
		<div>
			<h1>Home</h1>
			<p>Welcome to the Buzola example! This app demonstrates page-centric routing.</p>
			<LongContent label="Home" />
		</div>
	))
