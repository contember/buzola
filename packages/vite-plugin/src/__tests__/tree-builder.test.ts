import { describe, expect, it } from 'bun:test'
import type { ModuleLoader } from '../generator/page-extractor.js'
import type { ScannedFile } from '../generator/scanner.js'
import { buildFileRouteTree } from '../generator/tree-builder.js'

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
			{ absolutePath: '/app/src/routes/_layout.tsx', relativePath: '_layout.tsx' },
			{ absolutePath: '/app/src/routes/index.tsx', relativePath: 'index.tsx' },
			{ absolutePath: '/app/src/routes/users/_layout.tsx', relativePath: 'users/_layout.tsx' },
			{ absolutePath: '/app/src/routes/users/index.tsx', relativePath: 'users/index.tsx' },
			{ absolutePath: '/app/src/routes/users/detail.tsx', relativePath: 'users/detail.tsx' },
		]

		const tree = await buildFileRouteTree(files, emptyLoader)

		expect(tree).toHaveLength(1)
		const rootLayout = tree[0]
		expect(rootLayout.isLayout).toBe(true)
		expect(rootLayout.filePath).toBe('/app/src/routes/_layout.tsx')

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
						paramsMeta: [{ name: 'userId', optional: false, array: false }],
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
			{ pageId: 'users/detail', exportName: 'default', routePattern: '/users/:userId', params: [{ name: 'userId', optional: false, array: false }] },
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
				paramsMeta: [{ name: 'userId', optional: false, array: false }],
				// no .route() — should derive /users/detail from file path
			},
		})

		const tree = await buildFileRouteTree(files, loader)
		const users = tree.find(n => n.segment === 'users')
		expect(users).toBeDefined()
		expect(users!.children[0].segment).toBe('detail')
		expect(users!.children[0].fullPath).toBe('/users/detail')
		expect(users!.children[0].pageExports).toEqual([
			{ pageId: 'users/detail', exportName: 'default', routePattern: '/users/detail', params: [{ name: 'userId', optional: false, array: false }] },
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
			{ pageId: 'users', exportName: 'default', routePattern: '/users', params: [] },
		])
	})

	it('sorts not-found routes last', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/about.tsx', relativePath: 'about.tsx' },
			{ absolutePath: '/app/src/routes/_404.tsx', relativePath: '_404.tsx' },
			{ absolutePath: '/app/src/routes/users/index.tsx', relativePath: 'users/index.tsx' },
		]

		const tree = await buildFileRouteTree(files, emptyLoader)
		const segments = tree.map(n => n.segment)

		// _404 catch-all must be last
		expect(segments[segments.length - 1]).toBe(':__notFound+')
		const notFound = tree.find(n => n.isNotFound)
		expect(notFound).toBeDefined()
		expect(notFound!.fullPath).toBe('/:__notFound+')
	})

	// ─── Named exports ──────────────────────────────────────────────────────

	it('creates child nodes for named exports from regular files', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/users.tsx', relativePath: 'users.tsx' },
		]

		const loader: ModuleLoader = async () => ({
			default: {
				__buzolaPage: true,
				component: () => null,
				paramsMeta: [],
			},
			detail: {
				__buzolaPage: true,
				component: () => null,
				paramsMeta: [{ name: 'id', optional: false, array: false }],
			},
			settings: {
				__buzolaPage: true,
				component: () => null,
				paramsMeta: [],
			},
		})

		const tree = await buildFileRouteTree(files, loader)
		const users = tree.find(n => n.segment === 'users')
		expect(users).toBeDefined()
		expect(users!.filePath).toBe('/app/src/routes/users.tsx')
		expect(users!.exportName).toBe('default')
		expect(users!.pageExports).toEqual([
			{ pageId: 'users', exportName: 'default', routePattern: '/users', params: [] },
		])

		// Named exports become children
		expect(users!.children).toHaveLength(2)
		const detail = users!.children.find(n => n.segment === 'detail')
		expect(detail).toBeDefined()
		expect(detail!.filePath).toBe('/app/src/routes/users.tsx')
		expect(detail!.exportName).toBe('detail')
		expect(detail!.fullPath).toBe('/users/detail')
		expect(detail!.pageExports).toEqual([
			{ pageId: 'users/detail', exportName: 'detail', routePattern: '/users/detail', params: [{ name: 'id', optional: false, array: false }] },
		])

		const settings = users!.children.find(n => n.segment === 'settings')
		expect(settings).toBeDefined()
		expect(settings!.fullPath).toBe('/users/settings')
	})

	it('creates sibling nodes for named exports from index files', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/users/index.tsx', relativePath: 'users/index.tsx' },
		]

		const loader: ModuleLoader = async () => ({
			default: {
				__buzolaPage: true,
				component: () => null,
				paramsMeta: [],
			},
			detail: {
				__buzolaPage: true,
				component: () => null,
				paramsMeta: [{ name: 'id', optional: false, array: false }],
			},
		})

		const tree = await buildFileRouteTree(files, loader)
		const users = tree.find(n => n.segment === 'users')
		expect(users).toBeDefined()

		// Default export → index node
		const index = users!.children.find(n => n.isIndex)
		expect(index).toBeDefined()
		expect(index!.filePath).toBe('/app/src/routes/users/index.tsx')

		// Named export → sibling of index (child of users)
		const detail = users!.children.find(n => n.segment === 'detail')
		expect(detail).toBeDefined()
		expect(detail!.filePath).toBe('/app/src/routes/users/index.tsx')
		expect(detail!.exportName).toBe('detail')
		expect(detail!.fullPath).toBe('/users/detail')
		expect(detail!.pageExports).toEqual([
			{ pageId: 'users/detail', exportName: 'detail', routePattern: '/users/detail', params: [{ name: 'id', optional: false, array: false }] },
		])
	})

	it('creates container node when file has only named exports', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/users.tsx', relativePath: 'users.tsx' },
		]

		const loader: ModuleLoader = async () => ({
			list: {
				__buzolaPage: true,
				component: () => null,
				paramsMeta: [],
			},
			detail: {
				__buzolaPage: true,
				component: () => null,
				paramsMeta: [],
			},
		})

		const tree = await buildFileRouteTree(files, loader)
		const users = tree.find(n => n.segment === 'users')
		expect(users).toBeDefined()
		expect(users!.filePath).toBeUndefined() // No default → no component
		expect(users!.pageExports).toBeUndefined()

		expect(users!.children).toHaveLength(2)
		expect(users!.children.find(n => n.segment === 'detail')).toBeDefined()
		expect(users!.children.find(n => n.segment === 'list')).toBeDefined()
	})

	it('named export with .route() uses explicit route pattern', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/users.tsx', relativePath: 'users.tsx' },
		]

		const loader: ModuleLoader = async () => ({
			detail: {
				__buzolaPage: true,
				component: () => null,
				route: '/users/:userId',
				paramsMeta: [{ name: 'userId', optional: false, array: false }],
			},
		})

		const tree = await buildFileRouteTree(files, loader)
		const users = tree.find(n => n.segment === 'users')
		expect(users!.children).toHaveLength(1)
		expect(users!.children[0].segment).toBe(':userId')
		expect(users!.children[0].fullPath).toBe('/users/:userId')
	})

	it('throws on collision: named export vs file in subdirectory', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/users.tsx', relativePath: 'users.tsx' },
			{ absolutePath: '/app/src/routes/users/detail.tsx', relativePath: 'users/detail.tsx' },
		]

		const loader: ModuleLoader = async (p) => {
			if (p === '/app/src/routes/users.tsx') {
				return {
					detail: {
						__buzolaPage: true,
						component: () => null,
						paramsMeta: [],
					},
				}
			}
			return {
				default: {
					__buzolaPage: true,
					component: () => null,
					paramsMeta: [],
				},
			}
		}

		expect(buildFileRouteTree(files, loader)).rejects.toThrow(/Route collision/)
	})

	it('throws on collision: named export from index vs file in same directory', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/users/detail.tsx', relativePath: 'users/detail.tsx' },
			{ absolutePath: '/app/src/routes/users/index.tsx', relativePath: 'users/index.tsx' },
		]

		const loader: ModuleLoader = async (p) => {
			if (p === '/app/src/routes/users/index.tsx') {
				return {
					detail: {
						__buzolaPage: true,
						component: () => null,
						paramsMeta: [],
					},
				}
			}
			return {
				default: {
					__buzolaPage: true,
					component: () => null,
					paramsMeta: [],
				},
			}
		}

		expect(buildFileRouteTree(files, loader)).rejects.toThrow(/Route collision/)
	})

	it('named exports from root index.tsx have correct paths (no double slashes)', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/index.tsx', relativePath: 'index.tsx' },
		]

		const loader: ModuleLoader = async () => ({
			default: {
				__buzolaPage: true,
				component: () => null,
				paramsMeta: [],
			},
			dashboard: {
				__buzolaPage: true,
				component: () => null,
				paramsMeta: [],
			},
		})

		const tree = await buildFileRouteTree(files, loader)

		const index = tree.find(n => n.isIndex)
		expect(index).toBeDefined()
		expect(index!.fullPath).toBe('/')

		const dashboard = tree.find(n => n.segment === 'dashboard')
		expect(dashboard).toBeDefined()
		expect(dashboard!.fullPath).toBe('/dashboard')
		expect(dashboard!.pageExports![0].routePattern).toBe('/dashboard')
	})

	it('handles nested _404 within a directory', async () => {
		const files: ScannedFile[] = [
			{ absolutePath: '/app/src/routes/users/index.tsx', relativePath: 'users/index.tsx' },
			{ absolutePath: '/app/src/routes/users/_404.tsx', relativePath: 'users/_404.tsx' },
		]

		const tree = await buildFileRouteTree(files, emptyLoader)
		const users = tree.find(n => n.segment === 'users')
		expect(users).toBeDefined()

		const notFound = users!.children.find(n => n.isNotFound)
		expect(notFound).toBeDefined()
		expect(notFound!.segment).toBe(':__notFound+')
		expect(notFound!.fullPath).toBe('/users/:__notFound+')
		expect(notFound!.pageExports).toEqual([
			{
				pageId: 'users/404',
				exportName: 'default',
				routePattern: '/users/:__notFound+',
				params: [{ name: '__notFound', optional: false, array: false }],
			},
		])
	})
})
