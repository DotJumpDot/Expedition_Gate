<script lang="ts">
	import { cleanSpeaker, parseNarration } from '$lib/narration';

	let {
		content,
		role,
		aborted = false,
		streaming = false,
		cjkLeak = false
	}: {
		content: string;
		role: 'player' | 'gm' | 'system';
		aborted?: boolean;
		streaming?: boolean;
		cjkLeak?: boolean;
	} = $props();

	const blocks = $derived(
		role === 'gm' ? parseNarration(content) : [{ type: 'narration' as const, text: content }]
	);
</script>

{#if role === 'player'}
	<div class="msg-enter flex justify-end">
		<div
			class="max-w-[85%] rounded-xl rounded-br-sm border border-primary/25 bg-primary/10 px-4 py-2.5 text-[15px] leading-relaxed"
		>
			{content}
		</div>
	</div>
{:else if role === 'system'}
	<div
		class="msg-enter mx-auto max-w-[85%] rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-center text-xs text-muted-foreground"
	>
		{content}
	</div>
{:else}
	<article class="msg-enter {aborted ? 'opacity-60' : ''}" data-aborted={aborted}>
		{#if aborted}
			<p class="mb-1 text-xs text-muted-foreground">⏹ หยุดกลางคัน — บทนี้ไม่ถูกบันทึก</p>
		{/if}
		{#if cjkLeak}
			<p class="mb-1 text-xs text-muted-foreground">
				⚠ ตรวจพบอักษรจีนหลุดรอดในบทนี้ (เขียนใหม่อัตโนมัติแล้วแต่ยังเหลืออยู่)
			</p>
		{/if}
		<div class="stream-wrap space-y-3" data-streaming={streaming}>
			{#each blocks as block, i (i)}
				{#if block.type === 'dialogue'}
					<div class="flex flex-col items-start" style="animation-delay: {Math.min(i * 30, 120)}ms">
						<div class="dialogue-card">
							<span class="text-[13px] font-bold text-gold">{cleanSpeaker(block.speaker)}</span>
							<p class="mt-0.5 text-[15px] leading-relaxed">{block.line}</p>
						</div>
					</div>
				{:else if block.type === 'status'}
					<div class="status-line">📊 {block.text.replace('📊', '').trim()}</div>
				{:else}
					<p class="text-[15px] leading-[1.9] text-pretty text-foreground/95">{block.text}</p>
				{/if}
			{/each}
			{#if streaming}
				<span class="stream-caret" aria-hidden="true"></span>
			{/if}
		</div>
	</article>
{/if}

<style>
	/* Streaming reveal: a soft gold edge glows only while the GM is talking. */
	.stream-wrap {
		border-left: 2px solid transparent;
		padding-left: 0.75rem;
		margin-left: -0.875rem;
		transition: border-color 0.6s var(--ease-out);
	}
	.stream-wrap[data-streaming='true'] {
		border-left-color: color-mix(in oklch, var(--color-gold) 45%, transparent);
	}

	.dialogue-card {
		max-width: 92%;
		border-left: 2px solid var(--color-gold);
		background: color-mix(in oklch, var(--color-card) 82%, transparent);
		border-radius: 0 var(--radius-lg) var(--radius-lg) var(--radius-lg);
		padding: 0.5rem 0.9rem 0.6rem;
	}

	.status-line {
		display: inline-block;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-gold) 35%, transparent);
		background: color-mix(in oklch, var(--color-gold) 8%, transparent);
		padding: 0.25rem 0.75rem;
		font-size: 0.8rem;
		color: var(--color-gold);
		white-space: pre-wrap;
	}

	@keyframes caret-blink {
		50% {
			opacity: 0;
		}
	}

	.stream-caret {
		display: inline-block;
		width: 2px;
		height: 1.1em;
		margin-left: 2px;
		vertical-align: text-bottom;
		background: var(--color-gold);
		animation: caret-blink 1s steps(1) infinite;
	}

	.msg-enter {
		animation: msg-rise 0.3s var(--ease-out) backwards;
	}

	@keyframes msg-rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.msg-enter {
			animation: msg-fade 0.15s ease backwards;
		}
		.stream-caret {
			animation: none;
		}
		@keyframes msg-fade {
			from {
				opacity: 0;
			}
		}
	}
</style>
