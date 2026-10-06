<script lang="ts">
	import { onMount } from 'svelte';

	type Status = 'checking' | 'online' | 'offline';

	let status = $state<Status>('checking');
	let model = $state('');
	let error = $state('');

	const label = $derived(
		status === 'checking'
			? 'กำลังตรวจ GM…'
			: status === 'online'
				? model || 'GM พร้อมใช้งาน'
				: 'GM ออฟไลน์'
	);
	const tooltip = $derived(
		status === 'offline' ? error || 'ไม่พบ llama-server — เปิดเซิร์ฟเวอร์ก่อนเริ่มผจญภัย' : model
	);

	async function check() {
		status = 'checking';
		try {
			const res = await fetch('/api/llama/health', { cache: 'no-store' });
			const data = (await res.json()) as { online: boolean; model?: string; error?: string };
			status = data.online ? 'online' : 'offline';
			model = data.model ?? '';
			error = data.error ?? '';
		} catch {
			status = 'offline';
			error = 'ติดต่อเซิร์ฟเวอร์แอปไม่ได้';
		}
	}

	onMount(() => {
		void check();
		// Poll only while the tab is visible — no background battery drain.
		let timer: ReturnType<typeof setInterval> | undefined;
		const start = () => {
			if (timer === undefined) timer = setInterval(() => void check(), 30_000);
		};
		const stop = () => {
			if (timer !== undefined) {
				clearInterval(timer);
				timer = undefined;
			}
		};
		const onVisibility = () => {
			if (document.visibilityState === 'visible') {
				void check();
				start();
			} else {
				stop();
			}
		};
		start();
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			stop();
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});
</script>

<button
	type="button"
	onclick={() => void check()}
	title={tooltip}
	aria-live="polite"
	aria-label="สถานะผู้เล่าเรื่อง (GM) — คลิกเพื่อตรวจใหม่"
	class="chip-press inline-flex h-8 items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-colors duration-150 hover:text-foreground"
>
	<span
		class="size-2 shrink-0 rounded-full transition-colors duration-150 {status === 'online'
			? 'ember-pulse bg-xp'
			: status === 'checking'
				? 'bg-muted-foreground/50'
				: 'bg-destructive'}"
	></span>
	<span class="max-w-44 truncate">{label}</span>
</button>

<style>
	.chip-press:active {
		transform: scale(0.97);
	}
	.chip-press {
		transition-property: color, background-color, border-color, transform;
		transition-duration: 150ms;
		transition-timing-function: var(--ease-out);
	}
	@media (prefers-reduced-motion: reduce) {
		.chip-press:active {
			transform: none;
		}
	}
</style>
