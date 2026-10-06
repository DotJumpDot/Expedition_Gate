<script lang="ts">
	import WorldWizard from '$lib/components/WorldWizard.svelte';
</script>

<svelte:head>
	<title>สร้างการผจญภัยใหม่ — ประตูนักสำรวจ</title>
</svelte:head>

<!-- Deep links live in the query (?scenario=<id>, ?mode=custom); the wizard
     reads them itself from $app/state. -->
<WorldWizard />
