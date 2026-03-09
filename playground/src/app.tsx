import { BuzolaProvider } from '@buzola/router'
import React from 'react'
import { pageRegistry, routes } from './buzola.gen'

export function App() {
	return <BuzolaProvider routes={routes} pageRegistry={pageRegistry} />
}
