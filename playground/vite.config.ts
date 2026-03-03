import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { buzolaPlugin } from '../packages/vite-plugin/src/plugin'

export default defineConfig({
	plugins: [
		buzolaPlugin({ routeConfigFile: 'src/routes.ts' }),
		react(),
	],
})
