import { describe, expect, it } from 'bun:test'
import type { ModuleLoader } from '../generator/page-extractor'
import type { ScannedFile } from '../generator/scanner'
import { buildFileRouteTree } from '../generator/tree-builder'

/** Module loader that returns empty modules (no page exports). */
const emptyLoader: ModuleLoader = async () => ({})

describe('buildFileRouteTree', () => {
	it('builds a tree from flat files', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/index.tsx', relativePath: 'index.tsx' },
			{ absolutePath: '/app/src/routes/about.tsx', relativePath: 'about.tsx' },
		]

		const tree = await buildFileRouteTree(files, emptyLoader)
		expect(tree).toHaveLength(2)

		const index = tree.find(n => n.isIndex)
		expect(index).toBeDefined()
		expect(index!.fullPath).toBe('/')

		const about = tree.find(n => n.segment === 'about')
		expect(about).toBeDefined()
		expect(about!.fullPath).toBe('/about')
	})

	it('builds nested routes with layouts', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/layout.tsx', relativePath: 'layout.tsx' },
			{ absolutePath: '/app/src/routes/index.tsx', relativePath: 'index.tsx' },
			{ absolutePath: '/app/src/routes/users/layout.tsx', relativePath: 'users/layout.tsx' },
			{ absolutePath: '/app/src/routes/users/index.tsx', relativePath: 'users/index.tsx' },
			{ absolutePath: '/app/src/routes/users/detail.tsx', relativePath: 'users/detail.tsx' },
		]

		const tree = await buildFileRouteTree(files, emptyLoader)

		expect(tree).toHaveLength(1)
		const rootLayout = tree[0]
		expect(rootLayout.isLayout).toBe(true)
		expect(rootLayout.filePath).toBe('/app/src/routes/layout.tsx')

		const rootIndex = rootLayout.children.find(n => n.isIndex)
		expect(rootIndex).toBeDefined()

		const usersLayout = rootLayout.children.find(n => n.isLayout && n.segment === 'users')
		expect(usersLayout).toBeDefined()

		expect(usersLayout!.children).toHaveLength(2)
		const usersIndex = usersLayout!.children.find(n => n.isIndex)
		expect(usersIndex).toBeDefined()
		const detail = usersLayout!.children.find(n => n.segment === 'detail')
		expect(detail).toBeDefined()
	})

	it('handles pathless groups', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/(auth)/login.tsx', relativePath: '(auth)/login.tsx' },
		]

		const tree = await buildFileRouteTree(files, emptyLoader)
		const authGroup = tree.find(n => n.isPathlessGroup)
		expect(authGroup).toBeDefined()
	})

	it('uses plain file names as segments', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/users/detail.tsx', relativePath: 'users/detail.tsx' },
		]

		const tree = await buildFileRouteTree(files, emptyLoader)
		const users = tree.find(n => n.segment === 'users')
		expect(users).toBeDefined()
		expect(users!.children).toHaveLength(1)
		expect(users!.children[0].segment).toBe('detail')
		expect(users!.children[0].fullPath).toBe('/users/detail')
	})

	it('derives segment from page .route() via module loader', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/users/detail.tsx', relativePath: 'users/detail.tsx' },
		]

		const loader: ModuleLoader = async (p) => {
			if (p === '/app/src/routes/users/detail.tsx') {
				return {
					default: {
						__buzolaPage: true,
						component: () => null,
						route: '/users/:userId',
						paramsMeta: [{ name: 'userId', optional: false }],
					},
				}
			}
			return {}
		}

		const tree = await buildFileRouteTree(files, loader)
		const users = tree.find(n => n.segment === 'users')
		expect(users).toBeDefined()
		expect(users!.children).toHaveLength(1)
		expect(users!.children[0].segment).toBe(':userId')
		expect(users!.children[0].fullPath).toBe('/users/:userId')
		expect(users!.children[0].pageExports).toEqual([
			{ pageId: 'users/detail', routePattern: '/users/:userId', params: [{ name: 'userId', optional: false }] },
		])
	})

	it('derives route from file path when no .route()', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/users/detail.tsx', relativePath: 'users/detail.tsx' },
		]

		const loader: ModuleLoader = async () => ({
			default: {
				__buzolaPage: true,
				component: () => null,
				paramsMeta: [{ name: 'userId', optional: false }],
				// no .route() — should derive /users/detail from file path
			},
		})

		const tree = await buildFileRouteTree(files, loader)
		const users = tree.find(n => n.segment === 'users')
		expect(users).toBeDefined()
		expect(users!.children[0].segment).toBe('detail')
		expect(users!.children[0].fullPath).toBe('/users/detail')
		expect(users!.children[0].pageExports).toEqual([
			{ pageId: 'users/detail', routePattern: '/users/detail', params: [{ name: 'userId', optional: false }] },
		])
	})

	it('derives route for index file when no .route()', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/users/index.tsx', relativePath: 'users/index.tsx' },
		]

		const loader: ModuleLoader = async () => ({
			default: {
				__buzolaPage: true,
				component: () => null,
				paramsMeta: [],
			},
		})

		const tree = await buildFileRouteTree(files, loader)
		const users = tree.find(n => n.segment === 'users')
		const index = users!.children.find(n => n.isIndex)
		expect(index).toBeDefined()
		expect(index!.pageExports).toEqual([
			{ pageId: 'users', routePattern: '/users', params: [] },
		])
	})

	it('sorts catch-all routes last', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/about.tsx', relativePath: 'about.tsx' },
			{ absolutePath: '/app/src/routes/not-found.tsx', relativePath: 'not-found.tsx' },
			{ absolutePath: '/app/src/routes/users/index.tsx', relativePath: 'users/index.tsx' },
		]

		const loader: ModuleLoader = async (p) => {
			if (p.endsWith('not-found.tsx')) {
				return {
					default: {
						__buzolaPage: true,
						component: () => null,
						route: '/:path+',
						paramsMeta: [{ name: 'path', optional: false }],
					},
				}
			}
			if (p.endsWith('about.tsx')) {
				return {
					default: {
						__buzolaPage: true,
						component: () => null,
						route: '/about',
						paramsMeta: [],
					},
				}
			}
			if (p.endsWith('users/index.tsx')) {
				return {
					default: {
						__buzolaPage: true,
						component: () => null,
						route: '/users',
						paramsMeta: [],
					},
				}
			}
			return {}
		}

		const tree = await buildFileRouteTree(files, loader)
		const segments = tree.map(n => n.segment)

		// catch-all (:path+) must be last
		expect(segments[segments.length - 1]).toBe(':path+')
	})
})
