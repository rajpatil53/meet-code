<script lang="ts">
	import Icon from '@iconify/svelte';

	const copyLinkMessage = 'Copy meeting link';
	const { text } = $props<{ text: string }>();
	let tooltipMessage = $state(copyLinkMessage);

	function copyLink() {
		navigator.clipboard.writeText(text);
		setTimeout(() => {
			tooltipMessage = copyLinkMessage;
		}, 3000);
		tooltipMessage = 'URL copied!';
	}
</script>

<button on:click={(e) => copyLink()} class="tooltip" data-tip={tooltipMessage}>
	<Icon icon="lucide:copy" class="text-2xl" />
</button>
