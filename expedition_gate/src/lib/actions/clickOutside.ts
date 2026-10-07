/**
 * Popover dismissal: close on outside pointer press or Escape. Attach to the
 * wrapper that contains BOTH the toggle button and the panel — clicks on the
 * toggle stay inside the wrapper, so the close never fights the open toggle.
 */

export type ClickOutsideCallback = () => void;

export function clickOutside(node: HTMLElement, callback: ClickOutsideCallback) {
	function onPointerDown(event: PointerEvent) {
		if (!node.contains(event.target as Node)) callback();
	}
	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') callback();
	}
	// Capture phase: settle the close before other click handlers run.
	window.addEventListener('pointerdown', onPointerDown, true);
	window.addEventListener('keydown', onKeydown, true);
	return {
		destroy() {
			window.removeEventListener('pointerdown', onPointerDown, true);
			window.removeEventListener('keydown', onKeydown, true);
		}
	};
}
