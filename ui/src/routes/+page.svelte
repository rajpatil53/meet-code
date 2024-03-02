<script lang="ts">
	import { PUBLIC_HTTP_BASE_URL } from '$env/static/public';
	import type { Room } from '$lib/types';
	import type { PageData } from './$types';

	export let data: PageData;
	const { rooms } = data;

	const createRoom = async () => {
		const resp = await fetch(PUBLIC_HTTP_BASE_URL + '/rooms', { method: 'POST' });
		const newRoom: Room = await resp.json();
		window.location.pathname = `/rooms/${newRoom.id}`;
	};
</script>

<main class="prose-xl container mx-auto flex h-screen items-center justify-between pt-12">
	<div>
		<h1><span class="text-primary">Meet</span>Code</h1>
		<button class="btn btn-active" on:click={createRoom}>Create new room</button>
	</div>
	<div>
		{#if rooms.length > 0}
			<h2>Or join existing rooms:</h2>
			<ol class="list-decimal">
				{#each rooms as room}
					<li>
						<a href={`/rooms/${room.id}`} class="btn-link">{room.id}</a>
						({room.memberCount} participants)
					</li>
				{/each}
			</ol>
		{/if}
	</div>
</main>
