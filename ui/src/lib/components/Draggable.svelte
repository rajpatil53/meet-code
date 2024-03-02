<script lang="ts">
	interface DraggableProps {
		initialX: number;
		initialY: number;
		active: boolean;
	}

	let { initialX, initialY, active } = $props<DraggableProps>();
	let left = $state(initialX);
	let top = $state(initialY);
	let moving = $state(false);

	$effect(() => {
		left = initialX;
		top = initialY;
	});

	function onMouseDown() {
		moving = true;
	}

	function onMouseMove(e: MouseEvent) {
		if (moving) {
			left += e.movementX;
			top += e.movementY;
		}
	}

	function onMouseUp() {
		moving = false;
	}
</script>

<div
	on:mousedown={onMouseDown}
	style="left: {left}px; top: {top}px;"
	class:select-none={active}
	class:cursor-move={active}
	class:fixed={active}
>
	<slot />
</div>

<svelte:window on:mouseup={onMouseUp} on:mousemove={onMouseMove} />
