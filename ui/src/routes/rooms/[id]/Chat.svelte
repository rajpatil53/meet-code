<script lang="ts">
	import type { ChatMessage } from '$lib/types';
	import Icon from '@iconify/svelte';

	interface ChatProps {
		messages: ChatMessage[];
		onSend: (text: string) => void;
	}
	const { messages, onSend } = $props<ChatProps>();
	let text = $state('');
</script>

<div
	class="border-l-neutral bg-base-200 flex h-full w-96 flex-col justify-between gap-4 border-l-2 px-2"
>
	<div class="flex h-full flex-col overflow-y-auto">
		<div class="flex-1"></div>
		{#each messages as message}
			<div
				class="chat"
				class:chat-start={message.sender != 'me'}
				class:chat-end={message.sender == 'me'}
			>
				<div class="chat-header">{message.sender}</div>
				<div class="chat-bubble" class:chat-bubble-info={message.sender != 'me'}>
					{message.text}
				</div>
			</div>
		{/each}
	</div>
	<form class="form-control mb-24">
		<div class="input-group flex gap-2">
			<textarea
				bind:value={text}
				rows="1"
				placeholder="Type a message..."
				class="textarea textarea-bordered w-full"
			/>
			<button
				class="btn btn-square btn-primary"
				on:click={() => {
					onSend(text);
					text = '';
				}}
			>
				<Icon icon="lucide:send" class="text-2xl" />
			</button>
		</div>
	</form>
</div>
