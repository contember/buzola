// Read without a `typeof process` guard, so a bundler that replaces `process.env.NODE_ENV` also does it in a browser.
function readIsDev(): boolean {
	try {
		return process.env.NODE_ENV !== 'production'
	} catch {
		return false
	}
}

export const isDev = readIsDev()
