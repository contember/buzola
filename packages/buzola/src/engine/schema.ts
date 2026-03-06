import type { StandardSchema } from './types'

/**
 * Built-in minimal Standard Schema builders for route params.
 * Use these when you don't need a full schema library like Zod or Valibot.
 *
 * @example
 * ```ts
 * import { s } from 'buzola'
 *
 * const page = createPage()
 *   .params(s.object({ id: s.string(), tab: s.optional(s.string()) }))
 *   .route('/project/:id')
 *   .render(({ params }) => <div>{params.id}</div>)
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

function object<T extends Record<string, StandardSchema>>(
	shape: T,
): StandardSchema<{ [K in keyof T]: T[K] extends StandardSchema<infer V> ? V : never }> {
	return {
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
