<script lang="ts">
	import { page } from '$app/state';
	import WorldWizard from '$lib/components/WorldWizard.svelte';

	// Deep links: /adventures/new?scenario=<id> lands on that story directly,
	// ?mode=custom opens the build-your-own-world tab.
	const scenarioId = page.url.searchParams.get('scenario') ?? '';
	const mode = page.url.searchParams.get('mode') === 'custom' ? 'custom' : 'scenario';
</script>

<svelte:head>
	<title>สร้างการผจญภัยใหม่ — ประตูนักสำรวจ</title>
</svelte:head>

<WorldWizard initialMode={mode} initialScenarioId={scenarioId} />
