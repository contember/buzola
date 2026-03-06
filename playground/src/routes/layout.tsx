import { Link, Outlet } from 'buzola'
import React from 'react'

export default function RootLayout() {
	return (
		<div>
			<nav>
				<Link to="index">Home</Link>
				<Link to="about">About</Link>
				<Link to="users">Users</Link>
				<Link to="users/detail" params={{ userId: '1' }}>User 1</Link>
				<Link to="users/detail" params={{ userId: '2' }}>User 2</Link>
				<Link to="users/settings" params={{ userId: '1' }}>User 1 Settings</Link>
			</nav>
			<main>
				<Outlet />
			</main>
		</div>
	)
}
