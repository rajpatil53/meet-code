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

<h1>MeetCode</h1>
<button class="btn btn-primary" on:click={createRoom}>Create room</button>

{#if rooms.length > 0}
	<h2>Open rooms:</h2>
	<ul>
		{#each rooms as room}
			<li>
				<a href={`/rooms/${room.id}`}>{room.id}</a>
			</li>
		{/each}
	</ul>
{/if}
