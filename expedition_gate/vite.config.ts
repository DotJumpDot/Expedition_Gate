import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// Pre-warm the dep optimizer: without this, the first visit to the game
	// screen triggers a mid-navigation "optimized dependencies changed" reload.
	// Keep in sync with the deep icon imports (`@lucide/svelte/icons/*`).
	optimizeDeps: {
		include: [
			'@microsoft/fetch-event-source',
			'@lucide/svelte/icons/book-open',
			'@lucide/svelte/icons/chevron-left',
			'@lucide/svelte/icons/download',
			'@lucide/svelte/icons/history',
			'@lucide/svelte/icons/image',
			'@lucide/svelte/icons/panel-left',
			'@lucide/svelte/icons/settings',
			'@lucide/svelte/icons/sparkles',
			'@lucide/svelte/icons/x'
		]
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			// Kit 3 removed the default `$lib` alias; shadcn-svelte components and
			// this project's conventions still use it.
			alias: { $lib: 'src/lib' },
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => (filename.includes('node_modules') ? undefined : true)
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a different environment, switch out the adapter.
			// see https://svelte.dev/docs/kit/adapters for more info.
			adapter: adapter()
		})
	],
	test: {
		environment: 'happy-dom',
		setupFiles: ['./tests/setup.ts'],
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
		exclude: ['tests/fake-llama/server.mjs']
	}
});
