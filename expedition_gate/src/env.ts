import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Explicit environment variables (SvelteKit 3 style).
 * Access via `import { LLAMA_URL } from '$app/env/private'` — server only.
 */
export const variables = defineEnvVars({
	LLAMA_URL: {
		description: 'Base URL ของ llama-server (OpenAI-compatible) บนเครื่อง — ห้ามชี้ไปที่คลาวด์',
		schema: (value) => value?.trim() || 'http://127.0.0.1:8080/v1'
	}
});
