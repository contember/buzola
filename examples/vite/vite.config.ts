import { buzolaPlugin } from '@buzola/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [
		buzolaPlugin(),
		react(),
	],
})
