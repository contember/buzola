import { Outlet } from 'buzola'
import React from 'react'

export default function UsersLayout() {
	return (
		<div>
			<h1>Users</h1>
			<Outlet fallback={<p>Loading...</p>} />
		</div>
	)
}
