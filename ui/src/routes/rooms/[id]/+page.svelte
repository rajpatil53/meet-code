<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import CopyTextButton from '$lib/components/CopyTextButton.svelte';
	import { browser } from '$app/environment';
	import { Peer } from '$lib/Peer';
	import { type SignalingChannel } from '$lib/channels/SignalingChannel.js';

	let { data } = $props();
	const { roomId } = data;

	let containerElement: HTMLDivElement;

	let isReady = $state(false);
	let hasError = $state(false);
	let peer: Peer | undefined = $state();
	let connectedPeers: string[] = $state([]);
	let signalingChannel: SignalingChannel | undefined = $state();
	let localStream: MediaStream;

	onMount(async () => {
		localStream = await window.navigator.mediaDevices.getUserMedia({ video: true, audio: true });

		const localVideo: HTMLVideoElement | null = document.getElementById(
			'localVideo'
		) as HTMLVideoElement;
		if (localVideo) {
			localVideo.srcObject = new MediaStream(localStream.getVideoTracks());
		}
		isReady = true;
	});

	onDestroy(() => {
		disconnect();
	});

	$effect(() => {
		const connectedPeersCount = connectedPeers.length + 1;
		let videoWidth = containerElement.clientWidth;
		let videoHeight = containerElement.clientHeight;
		let rowCount: number, colCount: number;
		if (connectedPeersCount > 0) {
			rowCount = Math.ceil(Math.sqrt(connectedPeersCount));
			colCount = Math.ceil(connectedPeersCount / rowCount);
			videoWidth = containerElement.clientWidth / rowCount;
			videoHeight = containerElement.clientHeight / colCount;
		}
		document.querySelectorAll('.video-container').forEach((v) => {
			(v as HTMLDivElement).style.width = `${videoWidth - 24 * (rowCount - 1)}px`;
			(v as HTMLDivElement).style.height = `${videoHeight - 24 * (colCount - 1) - 32}px`;
		});
	});

	async function connect() {
		if (browser) {
			const { WebsocketSignalingChannel } = await import(
				'$lib/channels/WebsocketSignalingChannel.js'
			);
			signalingChannel = new WebsocketSignalingChannel(roomId);
			peer = new Peer(signalingChannel, localStream);
			peer.addEventListener('connect', () => {
				connectedPeers = peer!.connectedPeers;
			});
			peer.addEventListener('error', () => {
				hasError = true;
			});
		}
	}

	function disconnect() {
		peer?.close();
	}

	function leaveMeeting() {
		disconnect();
		window.location.pathname = '/';
	}
</script>

{#if peer && connectedPeers.length == 0}
	<div class="toast toast-top toast-end">
		<div class="alert alert-success">
			<span>Waiting for other people to join...</span>
		</div>
	</div>
{/if}

<div
	class="alert absolute bottom-0 left-1/2 z-10 my-8 flex w-fit -translate-x-1/2 items-center gap-4"
>
	<p class="my-0">Meeting ID: {roomId}</p>
	<CopyTextButton
		text={browser
			? window.location.protocol + '//' + window.location.host + `/rooms/${roomId}`
			: ''}
	/>
	{#if hasError}
		<p>Could not join the room.</p>
		<button class="btn btn-primary" on:click={() => (window.location.pathname = '/')}>
			Go to home
		</button>
	{:else if !peer && isReady}
		<button class="btn btn-primary" on:click={connect}>Join meeting</button>
	{:else if peer}
		<div class="itemce flex items-center gap-4">
			<button class="btn btn-error" on:click={leaveMeeting}>Leave meeting</button>
		</div>
	{/if}
</div>
<div
	class="preview-container flex h-screen w-full flex-wrap items-center justify-center gap-6 py-4"
	bind:this={containerElement}
>
	<div class="video-container">
		<video class="not-prose" id="localVideo" autoplay playsinline controls={false}>
			<track kind="captions" />
		</video>
	</div>
</div>
