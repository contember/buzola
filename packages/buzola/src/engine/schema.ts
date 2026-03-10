import type { StandardSchema } from './types'

/**
 * Built-in minimal Standard Schema builders for route params.
 * Use these when you don't need a full schema library like Zod or Valibot.
 *
 * @example
 * ```ts
 * import { s } from '@buzola/router'
 *
 * const page = createPage()
 *   .params({ id: s.string(), tab: s.optional(s.string()) })
 *   .route('/project/:id')
 *   .render(({ params }) => <div>{params.id}</div>)
 * ```
 *
 * Or use string literals for common types:
 * ```ts
 * createPage()
 *   .params({ id: 'uuid', order: 'number', text: '?string', tags: '?string[]' })
 * ```
 */

function string(): StandardSchema<string> {
	return {
		'~standard': {
			version: 1,
			vendor: 'buzola',
			validate: (v) => typeof v === 'string' ? { value: v } : { issues: [{ message: 'expected string' }] },
		},
	}
}

function optional(schema: StandardSchema<string>): StandardSchema<string | undefined> {
	return {
		'~standard': {
			version: 1,
			vendor: 'buzola',
			validate: (v) => v === undefined || v === '' ? { value: undefined } : schema['~standard'].validate(v) as { value: string | undefined },
		},
	}
}

export function isOptionalSchema(schema: StandardSchema): boolean {
	const result = schema['~standard'].validate(undefined)
	return !('issues' in result)
}

function object<T extends Record<string, StandardSchema>>(
	shape: T,
): StandardSchema<{ [K in keyof T]: T[K] extends StandardSchema<infer V> ? V : never }> & {
	__buzolaKeys: { name: string; optional: boolean; array: boolean }[]
} {
	return {
		__buzolaKeys: Object.entries(shape).map(([name, s]) => ({ name, optional: isOptionalSchema(s), array: false })),
		'~standard': {
			version: 1,
			vendor: 'buzola',
			validate: (v) => {
				const input = (v ?? {}) as Record<string, unknown>
				const result: Record<string, unknown> = {}
				for (const [key, schema] of Object.entries(shape)) {
					const r = schema['~standard'].validate(input[key])
					if ('issues' in r) return r
					result[key] = r.value
				}
				return { value: result } as { value: { [K in keyof T]: T[K] extends StandardSchema<infer V> ? V : never } }
			},
		},
	}
}

export const s = { object, string, optional }

/**
 * Validate a value against a Standard Schema, throwing on failure.
 */
export function validateSchema<T>(schema: StandardSchema<T>, value: unknown, errorPrefix: string): T {
	const result = schema['~standard'].validate(value)
	if ('issues' in result) {
		throw new Error(`${errorPrefix}${result.issues.map(i => i.message).join(', ')}`)
	}
	return result.value
}

// ─── Param literals ─────────────────────────────────────────────────────────

export type ParamLiteral = 'string' | 'number' | 'uuid' | '?string' | '?number' | '?uuid' | 'string[]' | 'number[]' | '?string[]' | '?number[]'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ScalarValidator = (v: unknown) => { value: unknown } | { issues: readonly { message: string }[] }

const scalarValidators: Record<string, ScalarValidator> = {
	string: (v) => typeof v === 'string' ? { value: v } : { issues: [{ message: 'expected string' }] },
	number: (v) => {
		const n = Number(v)
		return Number.isNaN(n) ? { issues: [{ message: 'expected number' }] } : { value: n }
	},
	uuid: (v) => typeof v === 'string' && UUID_RE.test(v) ? { value: v } : { issues: [{ message: 'expected UUID' }] },
}

export function resolveParamLiteral(literal: ParamLiteral): {
	schema: StandardSchema
	optional: boolean
	array: boolean
} {
	const isOpt = literal.startsWith('?')
	const rest = isOpt ? literal.slice(1) : literal
	const isArr = rest.endsWith('[]')
	const baseType = isArr ? rest.slice(0, -2) : rest

	const validateScalar = scalarValidators[baseType]
	if (!validateScalar) throw new Error(`[buzola] Unknown param type: ${baseType}`)

	let validate: StandardSchema['~standard']['validate']

	if (isArr) {
		validate = (v) => {
			if (isOpt && (v === undefined || (Array.isArray(v) && v.length === 0))) return { value: undefined }
			if (!Array.isArray(v)) return { issues: [{ message: `expected ${baseType}[]` }] }
			const result: unknown[] = []
			for (const item of v) {
				const r = validateScalar(item)
				if ('issues' in r) return r
				result.push(r.value)
			}
			return { value: result }
		}
	} else if (isOpt) {
		validate = (v) => v === undefined || v === '' ? { value: undefined } : validateScalar(v)
	} else {
		validate = validateScalar
	}

	return {
		schema: { '~standard': { version: 1, vendor: 'buzola', validate } },
		optional: isOpt,
		array: isArr,
	}
}
