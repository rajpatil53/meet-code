<script>
	const { show } = $props();
</script>

<div class="drawer drawer-end" class:drawer-open={show}>
	<input id="chat-drawer" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content">
		<slot name="content" />
	</div>
	<div class="drawer-side overflow-hidden">
		<slot name="sidebar" />
	</div>
</div>
