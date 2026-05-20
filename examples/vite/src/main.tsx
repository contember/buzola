import { BuzolaProvider } from '@buzola/router'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { pageRegistry, routes } from 'virtual:buzola/routes'

createRoot(document.getElementById('root')!).render(
	<BuzolaProvider routes={routes} pageRegistry={pageRegistry} />,
)
