import { GlobalWindow } from 'happy-dom'

const window = new GlobalWindow()

for (const key of Object.getOwnPropertyNames(window)) {
	if (key in globalThis) continue
	try {
		Object.defineProperty(globalThis, key, {
			value: (window as unknown as Record<string, unknown>)[key],
			writable: true,
			configurable: true,
		})
	} catch {
		// Some properties can't be set — skip them
	}
}

Object.defineProperty(globalThis, 'window', { value: window, writable: true, configurable: true })
Object.defineProperty(globalThis, 'document', { value: window.document, writable: true, configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, writable: true, configurable: true })
Object.defineProperty(globalThis, 'HTMLElement', { value: window.HTMLElement, writable: true, configurable: true })
