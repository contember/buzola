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

	it('parses static route files', () => {
		const result = parseFileName('about')
		expect(result.segment).toBe('about')
		expect(result.isLayout).toBe(false)
		expect(result.isIndex).toBe(false)
	})

	it('parses dynamic segment files', () => {
		const result = parseFileName('[userId]')
		expect(result.segment).toBe(':userId')
		expect(result.paramName).toBe('userId')
	})

	it('parses catch-all files', () => {
		const result = parseFileName('[...slug]')
		expect(result.segment).toBe(':slug+')
		expect(result.isCatchAll).toBe(true)
		expect(result.paramName).toBe('slug')
	})
})

describe('parseDirName', () => {
	it('parses pathless groups', () => {
		const result = parseDirName('(auth)')
		expect(result.isPathlessGroup).toBe(true)
		expect(result.segment).toBe('')
	})

	it('parses dynamic directories', () => {
		const result = parseDirName('[userId]')
		expect(result.segment).toBe(':userId')
		expect(result.paramName).toBe('userId')
	})

	it('parses regular directories', () => {
		const result = parseDirName('users')
		expect(result.segment).toBe('users')
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

	it('parses dynamic nested file', () => {
		const result = parseRouteFile('users/[userId].tsx')
		expect(result.segment).toBe('users/:userId')
		expect(result.paramName).toBe('userId')
	})
})
