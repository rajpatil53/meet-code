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

<main class="pt-12">
	<h1>MeetCode</h1>
	<button class="btn btn-primary" on:click={createRoom}>Create new room</button>

	{#if rooms.length > 0}
		<h2>Or join existing rooms:</h2>
		<ul>
			{#each rooms as room}
				<li>
					<a href={`/rooms/${room.id}`}>{room.id}</a>
					({room.memberCount} participants)
				</li>
			{/each}
		</ul>
	{/if}
</main>
