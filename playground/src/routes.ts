import { defineRoutes } from 'buzola'
import { About, Home, NotFound, RootLayout, UserDetail, UserSettings, UsersLayout, UsersList } from './app'

export const routes = defineRoutes(route => [
	route('/', { component: RootLayout }, [
		route('/', { component: Home }),
		route('/about', { component: About }),
		route('/users', { component: UsersLayout }, [
			route('/', { component: UsersList }),
			route('/:userId', { component: UserDetail }),
			route('/:userId/settings', { component: UserSettings }),
		]),
		route('/:path+', { component: NotFound }),
	]),
])
