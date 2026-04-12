import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import wasm from 'vite-plugin-wasm';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
	},
	plugins: [
		wasm(),
		react(),
		babel({ presets: [reactCompilerPreset()] }),
		visualizer({
			filename: 'dist/stats.html',
			gzipSize: true,
			brotliSize: true,
		}) as never,
		VitePWA({
			registerType: 'autoUpdate',
			// Enable SW in dev mode so PWA features (push, offline, install) work
			// during local development and can be exercised by E2E tests.
			devOptions: {
				enabled: true,
				type: 'module',
			},
			includeAssets: ['corp-logo.png'],
			manifest: {
				name: 'Corp Matrix',
				short_name: 'Corp Matrix',
				description: 'Secure corporate messenger built on the Matrix protocol',
				theme_color: '#4a90d9',
				background_color: '#0d1117',
				display: 'standalone',
				start_url: '/',
				scope: '/',
				icons: [
					{ src: '/corp-logo.png', sizes: '512x512', type: 'image/png' },
					{ src: '/corp-logo.png', sizes: '192x192', type: 'image/png' },
					{
						src: '/corp-logo.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,wasm,svg,png,jpg,json}'],
				maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
				importScripts: ['/sw-custom.js'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/.*\/_matrix\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'matrix-api',
							expiration: { maxEntries: 50, maxAgeSeconds: 300 },
						},
					},
				],
			},
		}),
	],
	resolve: {
		alias: {
			'@app': path.resolve(__dirname, 'src/app'),
			'@features': path.resolve(__dirname, 'src/features'),
			'@shared': path.resolve(__dirname, 'src/shared'),
			'@workers': path.resolve(__dirname, 'src/workers'),
		},
	},
	css: {
		modules: {
			localsConvention: 'camelCase',
		},
	},
	optimizeDeps: {
		exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
	},
});

