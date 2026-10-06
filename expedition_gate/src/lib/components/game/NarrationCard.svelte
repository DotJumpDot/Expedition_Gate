<script lang="ts">
	import {
		cleanSpeaker,
		inlineFormat,
		parseNarration,
		parseStatusSegments,
		speakerColor,
		type StatusKind
	} from '$lib/narration';

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

	const STATUS_CLS: Record<StatusKind, string> = {
		hp: 'st-hp',
		mana: 'st-mana',
		gold: 'st-gold',
		xp: 'st-xp',
		lv: 'st-lv',
		condition: 'st-cond',
		plain: 'st-plain'
	};
</script>

{#if role === 'player'}
	<div class="msg-enter flex justify-end">
		<div
			class="max-w-[85%] rounded-xl rounded-br-sm border border-primary/25 bg-primary/10 px-4 py-2.5 text-[0.95rem] leading-relaxed"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- inlineFormat escapes all model/player text first -->
			{@html inlineFormat(content)}
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
						<div class="dialogue-card" style="--spk: {speakerColor(cleanSpeaker(block.speaker))}">
							<span class="dlg-name">{cleanSpeaker(block.speaker)}</span>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped inside inlineFormat -->
							<p class="mt-0.5 text-[0.95rem] leading-[2]">{@html inlineFormat(block.line)}</p>
						</div>
					</div>
				{:else if block.type === 'status'}
					<div class="status-row">
						{#each parseStatusSegments(block.text) as segment (segment.text)}
							<span
								class="st-chip {segment.kind === 'condition' && segment.text.includes('ปกติ')
									? 'st-plain'
									: STATUS_CLS[segment.kind]}"
							>
								{segment.text}
							</span>
						{/each}
					</div>
				{:else}
					<p class="text-[0.95rem] leading-[2] text-pretty text-foreground/95">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped inside inlineFormat -->
						{@html inlineFormat(block.text)}
					</p>
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
		border-left: 2px solid var(--spk, var(--color-gold));
		background: color-mix(in oklch, var(--color-card) 82%, transparent);
		border-radius: 0 var(--radius-lg) var(--radius-lg) var(--radius-lg);
		padding: 0.5rem 0.9rem 0.6rem;
	}

	/* Speaker name in that speaker's stable color (same name = same color). */
	.dlg-name {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--spk, var(--color-gold));
	}

	/* Quoted speech inside narration — warm parchment tint. */
	.stream-wrap :global(.q) {
		color: color-mix(in oklch, var(--color-foreground) 82%, var(--color-gold));
	}

	/* *stage directions* — italic, hushed. */
	.stream-wrap :global(i.stage) {
		color: var(--color-muted-foreground);
	}

	/* 📊 status — one small chip per value, each in its game color. */
	.status-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.st-chip {
		border-radius: 9999px;
		border: 1px solid;
		padding: 0.18rem 0.7rem;
		font-size: 0.78rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.st-hp {
		border-color: color-mix(in oklch, var(--color-hp) 45%, transparent);
		background: color-mix(in oklch, var(--color-hp) 12%, transparent);
		color: var(--color-hp);
	}
	.st-mana {
		border-color: color-mix(in oklch, var(--color-mana) 45%, transparent);
		background: color-mix(in oklch, var(--color-mana) 12%, transparent);
		color: var(--color-mana);
	}
	.st-gold {
		border-color: color-mix(in oklch, var(--color-gold) 40%, transparent);
		background: color-mix(in oklch, var(--color-gold) 10%, transparent);
		color: var(--color-gold);
	}
	.st-xp {
		border-color: color-mix(in oklch, var(--color-xp) 45%, transparent);
		background: color-mix(in oklch, var(--color-xp) 12%, transparent);
		color: var(--color-xp);
	}
	.st-lv {
		border-color: color-mix(in oklch, var(--color-ember) 45%, transparent);
		background: color-mix(in oklch, var(--color-ember) 12%, transparent);
		color: var(--color-ember);
	}
	.st-cond {
		border-color: color-mix(in oklch, var(--color-destructive) 45%, transparent);
		background: color-mix(in oklch, var(--color-destructive) 12%, transparent);
		color: var(--color-destructive);
	}
	.st-plain {
		border-color: color-mix(in oklch, var(--color-border) 90%, transparent);
		background: color-mix(in oklch, var(--color-muted) 40%, transparent);
		color: var(--color-muted-foreground);
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
