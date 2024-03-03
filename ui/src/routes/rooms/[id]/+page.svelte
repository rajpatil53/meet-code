<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import CopyTextButton from '$lib/components/CopyTextButton.svelte';
	import { browser } from '$app/environment';
	import { Peer } from '$lib/Peer';
	import { type SignalingChannel } from '$lib/channels/SignalingChannel';
	import Icon from '@iconify/svelte';
	import Draggable from '$lib/components/Draggable.svelte';
	import { addFloatingWindowStyles, createVideoWindow } from '$lib/domUtils';

	let { data } = $props();
	const { roomId } = data;

	let previewContainerElement: HTMLDivElement;
	let localVideoElement: HTMLVideoElement;
	let floatingContainerElement: HTMLDivElement;

	let videoOn = $state(true);
	let audioOn = $state(true);
	let floatingContainerPosition = $state({ x: 0, y: 0 });
	let screenShareOn = $state(false);
	let screenShareStream: MediaStream | null = $state(null);
	let screenShareActive = $derived(!!screenShareStream);
	let isReady = $state(false);
	let hasError = $state(false);
	let peer: Peer | undefined = $state();
	let connectedPeers: string[] = $state([]);
	let signalingChannel: SignalingChannel | undefined = $state();
	let localStream: MediaStream;

	onMount(async () => {
		localStream = await window.navigator.mediaDevices.getUserMedia({ video: true, audio: true });

		if (localVideoElement) {
			localVideoElement.srcObject = new MediaStream(localStream.getVideoTracks());
		}
		isReady = true;
	});

	onDestroy(() => {
		disconnect();
	});

	$effect(() => {
		updateLayout();
	});

	$effect(() => {
		if (audioOn) {
			peer?.unmuteAudio();
			localStream?.getAudioTracks().forEach((track) => (track.enabled = true));
		} else {
			peer?.muteAudio();
			localStream?.getAudioTracks().forEach((track) => (track.enabled = false));
		}
	});

	$effect(() => {
		if (videoOn) {
			localStream?.getVideoTracks().forEach((track) => (track.enabled = true));
		} else {
			localStream?.getVideoTracks().forEach((track) => (track.enabled = false));
		}
	});

	function addVideoToFloatingContainer(element: HTMLElement) {
		addFloatingWindowStyles(element);
		floatingContainerElement.appendChild(element);
	}

	function updateLayout() {
		const connectedPeersCount = connectedPeers.length + 1;
		if (connectedPeersCount == 2 || screenShareActive) {
			addVideoToFloatingContainer(localVideoElement.parentElement!);
			untrack(() => calculateFloatingContainerPosition());
		} else if (floatingContainerElement.contains(localVideoElement.parentElement)) {
			previewContainerElement.appendChild(localVideoElement.parentElement!);
		}
		updateVideoContainerSizes(connectedPeersCount);
	}

	function updateVideoContainerSizes(connectedPeersCount: number) {
		let videoWidth = previewContainerElement.clientWidth;
		let videoHeight = previewContainerElement.clientHeight;
		let rowCount = 1,
			colCount = 1;
		if (connectedPeersCount > 2) {
			rowCount = Math.ceil(Math.sqrt(connectedPeersCount));
			colCount = Math.ceil(connectedPeersCount / rowCount);
			videoWidth = previewContainerElement.clientWidth / rowCount;
			videoHeight = previewContainerElement.clientHeight / colCount;
		}
		previewContainerElement.querySelectorAll('.video-container').forEach((v) => {
			(v as HTMLDivElement).style.width = `${videoWidth - 24 * (rowCount - 1)}px`;
			(v as HTMLDivElement).style.height = `${videoHeight - 24 * (colCount - 1) - 32}px`;
		});
	}

	async function connect() {
		if (browser) {
			const { WebsocketSignalingChannel } = await import('$lib/channels/WebsocketSignalingChannel');
			signalingChannel = new WebsocketSignalingChannel(roomId);
			peer = new Peer(signalingChannel, localStream);
			peer.addEventListener('connect', () => {
				connectedPeers = peer!.connectedPeers;
			});
			peer.addEventListener('error', () => {
				hasError = true;
			});
			peer.addEventListener('streamadded', (event) => {
				if (event.detail.type == 'screen') {
					screenShareStream = event.detail.stream;
					showDisplayStream(event.detail.source);
				} else {
					const videoWindow = createVideoWindow(event.detail.source, event.detail.stream);
					if (screenShareStream) {
						addVideoToFloatingContainer(videoWindow);
					} else {
						previewContainerElement.prepend(videoWindow);
					}
					updateLayout();
				}
			});
			peer.addEventListener('streamremoved', (event) => {
				if (event.detail.type == 'screen') {
					screenShareStream = null;
					removeDisplayStream();
				}
			});
			peer.addEventListener('muted', (event) => {
				const videoElement = document.getElementById(event.detail);
				(videoElement?.nextSibling as HTMLDivElement).classList.remove('hidden');
			});
			peer.addEventListener('unmuted', (event) => {
				const videoElement = document.getElementById(event.detail);
				(videoElement?.nextSibling as HTMLDivElement).classList.add('hidden');
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

	async function startCapture() {
		try {
			screenShareStream = await navigator.mediaDevices.getDisplayMedia({
				video: true,
				audio: false
			});
			screenShareOn = true;
			peer?.shareScreen(screenShareStream);
			showDisplayStream('localVideo');
			screenShareStream.getTracks().forEach((track) => {
				track.addEventListener('ended', () => {
					screenShareOn = false;
				});
			});
		} catch (err) {
			console.error(`Error: ${err}`);
		}
	}

	async function stopCapture() {
		const tracks = screenShareStream?.getTracks();

		tracks?.forEach((track) => {
			track.stop();
			// Manually calling stop does not trigger 'ended' event
			track.dispatchEvent(new Event('ended'));
		});
		tracks?.forEach((track) => {
			screenShareStream?.removeTrack(track);
		});

		screenShareStream = null;
	}

	function showDisplayStream(peerId: string) {
		previewContainerElement
			.querySelectorAll('.video-container')
			.forEach((container) => addVideoToFloatingContainer(container as HTMLElement));
		const screenShareWindow = createVideoWindow('screen', screenShareStream!);
		previewContainerElement.prepend(screenShareWindow);
		screenShareStream?.getTracks().forEach((track) => {
			track.addEventListener('ended', () => {
				screenShareStream = null;
				removeDisplayStream();
			});
		});
		console.log('peerId:', peerId);
		console.log('document.getElementById(peerId):', document.getElementById(peerId));
		document.getElementById(peerId)?.parentElement?.classList.add('screen-active');
	}

	function removeDisplayStream() {
		const screenVideo: HTMLVideoElement | null = document.getElementById(
			'screen'
		) as HTMLVideoElement;
		screenVideo?.parentElement?.remove();
		floatingContainerElement
			.querySelectorAll('.video-container')
			.forEach((container) => previewContainerElement.appendChild(container));
		document.querySelector('.screen-active')?.classList.remove('screen-active');
		updateLayout();
	}

	function calculateFloatingContainerPosition() {
		let x = 0,
			y = 0;
		if (browser) {
			x = window.innerWidth - floatingContainerElement.offsetWidth - 16;
			y = window.innerHeight - floatingContainerElement.offsetHeight - 16;
		}
		floatingContainerPosition = { x, y };
	}
</script>

{#if peer && connectedPeers.length == 0}
	<div class="toast toast-top toast-end">
		<div class="alert alert-info">
			<span>Waiting for other people to join...</span>
		</div>
	</div>
{/if}
{#if hasError}
	<div class="toast toast-top toast-end">
		<div class="alert alert-error">
			<span>Could not join the room.</span>
		</div>
	</div>
{/if}

<main class="mx-4">
	<div class="alert absolute bottom-0 left-1/2 z-10 flex w-max -translate-x-1/2 items-center gap-4">
		<div class="flex gap-2">
			<p class="my-0 whitespace-nowrap">Meeting ID: {roomId}</p>
			<CopyTextButton
				text={browser
					? window.location.protocol + '//' + window.location.host + `/rooms/${roomId}`
					: ''}
			/>
		</div>
		<div>
			<button
				class="btn btn-circle swap"
				class:swap-active={videoOn}
				class:btn-neutral={videoOn}
				class:btn-error={!videoOn}
				on:click={() => (videoOn = !videoOn)}
			>
				<Icon icon="lucide:video" class="swap-on text-2xl" />
				<Icon icon="lucide:video-off" class="swap-off text-2xl" />
			</button>
			<button
				class="btn btn-circle swap"
				class:swap-active={audioOn}
				class:btn-neutral={audioOn}
				class:btn-error={!audioOn}
				on:click={() => (audioOn = !audioOn)}
			>
				<Icon icon="lucide:mic" class="swap-on text-2xl" />
				<Icon icon="lucide:mic-off" class="swap-off text-2xl" />
			</button>
			<button
				class="btn btn-circle swap"
				class:swap-active={screenShareOn}
				class:btn-neutral={!screenShareOn}
				class:btn-accent={screenShareOn}
				on:click={() => (screenShareOn ? stopCapture() : startCapture())}
				disabled={screenShareActive && !screenShareOn}
			>
				<Icon icon="lucide:screen-share" class="swap-off text-2xl" />
				<Icon icon="lucide:screen-share-off" class="swap-on text-2xl" />
			</button>
		</div>
		{#if hasError}
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
	<div class="items-center" class:flex={screenShareActive}>
		<div
			class="preview-container flex h-screen w-full flex-wrap items-center justify-center gap-2 py-4"
			bind:this={previewContainerElement}
		>
			<div class="video-container">
				<video
					class="not-prose"
					id="localVideo"
					autoplay
					playsinline
					controls={false}
					bind:this={localVideoElement}
				>
					<track kind="captions" />
				</video>
			</div>
		</div>
		<Draggable
			initialX={floatingContainerPosition.x}
			initialY={floatingContainerPosition.y}
			active={!screenShareActive}
		>
			<div
				id="floating-container"
				class="join join-vertical border-neutral overflow-hidden border-4"
				bind:this={floatingContainerElement}
			></div>
		</Draggable>
	</div>
</main>
