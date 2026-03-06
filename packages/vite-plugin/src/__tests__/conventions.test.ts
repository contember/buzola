import { describe, expect, it } from 'bun:test'
import { isRouteFile, parseDirName, parseFileName, parseRouteFile } from '../conventions'

describe('isRouteFile', () => {
	it('accepts .tsx files', () => {
		expect(isRouteFile('index.tsx')).toBe(true)
	})

	it('accepts .jsx files', () => {
		expect(isRouteFile('layout.jsx')).toBe(true)
	})

	it('rejects .css files', () => {
		expect(isRouteFile('style.css')).toBe(false)
	})
})

describe('parseFileName', () => {
	it('parses layout files', () => {
		const result = parseFileName('layout')
		expect(result.isLayout).toBe(true)
		expect(result.segment).toBe('')
	})

	it('parses index files', () => {
		const result = parseFileName('index')
		expect(result.isIndex).toBe(true)
		expect(result.segment).toBe('')
	})

	it('parses regular page files', () => {
		const result = parseFileName('about')
		expect(result.segment).toBe('about')
		expect(result.isLayout).toBe(false)
		expect(result.isIndex).toBe(false)
	})

	it('treats bracket names as plain file names', () => {
		const result = parseFileName('[userId]')
		expect(result.segment).toBe('[userId]')
		expect(result.isLayout).toBe(false)
		expect(result.isIndex).toBe(false)
	})
})

describe('parseDirName', () => {
	it('parses pathless groups', () => {
		const result = parseDirName('(auth)')
		expect(result.isPathlessGroup).toBe(true)
		expect(result.segment).toBe('')
	})

	it('parses regular directories', () => {
		const result = parseDirName('users')
		expect(result.segment).toBe('users')
		expect(result.isPathlessGroup).toBe(false)
	})

	it('treats bracket names as plain directory names', () => {
		const result = parseDirName('[userId]')
		expect(result.segment).toBe('[userId]')
		expect(result.isPathlessGroup).toBe(false)
	})
})

describe('parseRouteFile', () => {
	it('parses root index', () => {
		const result = parseRouteFile('index.tsx')
		expect(result.isIndex).toBe(true)
		expect(result.segment).toBe('')
	})

	it('parses nested layout', () => {
		const result = parseRouteFile('users/layout.tsx')
		expect(result.isLayout).toBe(true)
		expect(result.segment).toBe('users')
	})

	it('parses regular nested file', () => {
		const result = parseRouteFile('users/detail.tsx')
		expect(result.segment).toBe('users/detail')
		expect(result.isLayout).toBe(false)
		expect(result.isIndex).toBe(false)
	})
})
