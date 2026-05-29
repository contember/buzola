import { createPage, useNavigate } from '@buzola/router'
import React from 'react'

export default createPage()
	.params({ userId: 'string' })
	.route('/users/:userId/settings')
	.render(({ params }) => {
		const navigate = useNavigate()
		return (
			<div>
				<h2>User Settings</h2>
				<div className="params">
					<p>userId: {params.userId}</p>
				</div>
				<p style={{ marginTop: '1rem' }}>
					<button onClick={() => navigate('users/detail', { params: { userId: params.userId } })}>
						Back to profile
					</button>
				</p>
			</div>
		)
	})
