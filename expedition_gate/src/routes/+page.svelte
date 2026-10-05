<script lang="ts">
	import { Compass, ScrollText } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
</script>

<svelte:head>
	<title>ประตูนักสำรวจ — เลือกการผจญภัยของคุณ</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-16 pb-24 sm:px-6 sm:pt-24">
	<section class="gate-rise flex flex-col items-center text-center" style="--stagger: 0">
		<h1 class="max-w-2xl text-4xl leading-[1.15] font-bold tracking-tight text-balance sm:text-5xl">
			ก้าวผ่านประตู
			<span class="text-primary">สู่การผจญภัยไร้ขอบเขต</span>
		</h1>
		<p class="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
			ผู้เล่าเรื่อง AI เป็นทั้งผู้เล่า กรรมการ และตัวละครทุกตัวในเรื่อง — จะเดินเรื่องแบบไหนก็ได้
			โลกจำเรื่องของคุณได้ และผลลัพธ์ทุกอย่างคงอยู่ เล่นได้เฉพาะบนเครื่องของคุณเอง 100%
		</p>
	</section>

	<section class="gate-rise mt-9 flex flex-col items-center gap-3" style="--stagger: 1">
		<Button size="lg" class="px-6 text-base" title="พร้อมใช้งานในเฟสถัดไป" disabled>
			<Compass data-icon="inline-start" aria-hidden="true" />
			สร้างโลกใหม่
		</Button>
		<p class="text-xs text-muted-foreground">
			เลือกฉาก เลือกโทนเรื่อง แล้วให้ผู้เล่าเรื่องสร้างโลกให้คุณ
		</p>
	</section>

	<section class="gate-rise mt-14 w-full max-w-xl" style="--stagger: 2">
		<div
			class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 px-6 py-10 text-center"
		>
			<ScrollText aria-hidden="true" class="size-7 text-muted-foreground/70" />
			<div>
				<p class="font-semibold">ยังไม่มีการผจญภัย</p>
				<p class="mt-1 text-sm text-muted-foreground">
					การผจญภัยทุกเรื่องของคุณจะถูกบันทึกไว้ที่นี่ — เริ่มเรื่องแรกของคุณเอง
				</p>
			</div>
		</div>
	</section>
</div>
