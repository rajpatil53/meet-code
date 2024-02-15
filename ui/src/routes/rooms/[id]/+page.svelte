<script lang="ts">
	import type { PeerConnection } from '$lib/types';
	import { onDestroy, onMount } from 'svelte';
	import { PUBLIC_WS_BASE_URL } from '$env/static/public';
	import Icon from '@iconify/svelte';

	let { data } = $props();
	const { roomId } = data;

	let containerElement: HTMLDivElement;

	enum WebSocketConnectionState {
		none,
		connected,
		error
	}
	const copyLinkMessage = 'Copy meeting link';
	let tooltipMessage: string = $state(copyLinkMessage);
	let peerConnections: PeerConnection[] = $state([]);
	let wsChannel: WebSocket;
	let localStream: MediaStream;
	let wsConnectionState = $state(WebSocketConnectionState.none);
	let connectedPeers: string[] = $state([]);

	onMount(setupLocalStream);

	onDestroy(() => {
		disconnect();
	});

	$effect(() => {
		let videoWidth: number;
		if (connectedPeers.length == 0) {
			videoWidth = containerElement?.clientWidth;
		} else {
			videoWidth = containerElement?.clientWidth / 2;
		}
		document.querySelectorAll('video').forEach((v) => (v.width = videoWidth - 24));
	});

	enum MessageType {
		// From client
		Join = 'Join',
		Offer = 'Offer',
		Answer = 'Answer',
		NewIceCandidate = 'NewIceCandidate',

		// From server
		CreateOffer = 'CreateOffer',
		SetOffer = 'SetOffer',
		SetAnswer = 'SetAnswer',
		AddIceCandidate = 'AddIceCandidate',
		RemovePeer = 'RemovePeer',
		RoomClosed = 'RoomClosed'
	}

	interface Message {
		type: MessageType;
		from?: string;
		data?: string;
		to?: string;
	}

	const servers: RTCConfiguration = {
		iceServers: [
			{
				urls: 'stun:stun1.l.google.com:19302'
			}
		]
	};
	const newCandidates: RTCIceCandidate[] = [];

	function getPeerConnectionFor(peerId: string): RTCPeerConnection {
		const peerConnection = peerConnections.find((c) => c.peerId == peerId);
		if (!peerConnection) {
			const newConnection = setupPeerConnection(peerId);
			console.log('Created new connection for: ', peerId);
			peerConnections.push(newConnection);
			peerConnections = peerConnections;
			return newConnection.conn;
		}
		return peerConnection!.conn;
	}

	function removeConnection(peerId: string) {
		const connection = peerConnections.find((c) => c.peerId == peerId);
		if (connection) {
			console.log('Closing: ', peerId);
			connection.conn.close();
			connectedPeers = connectedPeers.filter((peer) => peer != peerId);
			peerConnections = peerConnections.filter((c) => c.peerId === connection.peerId);
			const video = document.querySelector(`video#${peerId}`);
			video?.remove();
		}
	}

	async function setupLocalStream() {
		localStream = await window.navigator.mediaDevices.getUserMedia({ video: true, audio: false });

		const localVideo: HTMLVideoElement | null = document.getElementById(
			'localVideo'
		) as HTMLVideoElement;
		if (localVideo) {
			localVideo.srcObject = new MediaStream(localStream.getVideoTracks());
		}
	}

	function setupRemoteStream(peerId: string): MediaStream {
		const remoteStream = new MediaStream();

		const localVideo: HTMLVideoElement | null = document.getElementById(
			'localVideo'
		) as HTMLVideoElement;
		const remoteVideo = document.createElement('video');
		remoteVideo.id = peerId;
		remoteVideo.autoplay = true;
		remoteVideo.playsInline = true;
		remoteVideo.controls = false;
		if (remoteVideo) {
			remoteVideo.srcObject = remoteStream;
		}
		localVideo.parentElement?.prepend(remoteVideo);
		return remoteStream;
	}

	async function addNewIceCandidate(
		peerConnection: RTCPeerConnection,
		candidate?: RTCIceCandidate
	) {
		if (!candidate) {
			newCandidates.forEach((c) => {
				peerConnection.addIceCandidate(c);
			});
		} else {
			if (peerConnection.remoteDescription) {
				await peerConnection.addIceCandidate(candidate);
			} else {
				newCandidates.push(candidate);
			}
		}
	}

	async function setupSignalingChannel() {
		wsChannel = new WebSocket(`${PUBLIC_WS_BASE_URL}/rooms/${roomId}`);
		wsChannel.addEventListener('message', async (event) => {
			const message: Message = JSON.parse(event.data);
			console.log('Received msg: ', message);
			let peerConnection;
			switch (message.type) {
				case MessageType.CreateOffer:
					peerConnection = getPeerConnectionFor(message.from!);
					const offer = await peerConnection.createOffer();
					await peerConnection.setLocalDescription(offer);
					const offerMessage: Message = {
						type: MessageType.Offer,
						data: JSON.stringify(offer),
						to: message.from
					};
					wsChannel.send(JSON.stringify(offerMessage));
					break;
				case MessageType.SetOffer:
					peerConnection = getPeerConnectionFor(message.from!);
					peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(message.data!)));
					const answer = await peerConnection.createAnswer();
					await peerConnection.setLocalDescription(answer);
					const answerMessage: Message = {
						type: MessageType.Answer,
						data: JSON.stringify(answer),
						to: message.from
					};
					wsChannel.send(JSON.stringify(answerMessage));
					break;
				case MessageType.SetAnswer:
					peerConnection = getPeerConnectionFor(message.from!);
					if (peerConnection.signalingState == 'have-local-offer') {
						await peerConnection.setRemoteDescription(
							new RTCSessionDescription(JSON.parse(message.data!))
						);
						await addNewIceCandidate(peerConnection);
					}
					break;
				case MessageType.AddIceCandidate:
					peerConnection = getPeerConnectionFor(message.from!);
					addNewIceCandidate(peerConnection, JSON.parse(message.data!));
					break;
				case MessageType.RemovePeer:
					removeConnection(message.data!);
					break;
				case MessageType.RoomClosed:
					window.location.pathname = '/';
					break;
				default:
					break;
			}
		});
		wsChannel.addEventListener('open', (event) => {
			console.log('Opened: ', event);
			const joinMessage: Message = { type: MessageType.Join };
			wsChannel.send(JSON.stringify(joinMessage));
			wsConnectionState = WebSocketConnectionState.connected;
		});
		wsChannel.addEventListener('close', (event) => {
			console.log('Closed: ', event);
			wsConnectionState = WebSocketConnectionState.none;
		});
		wsChannel.addEventListener('error', (event) => {
			console.log('Error: ', event);
			wsConnectionState = WebSocketConnectionState.error;
		});
	}

	function setupPeerConnection(peerId: string): PeerConnection {
		const rtcPeerConnection = new RTCPeerConnection(servers);
		const remoteStream = setupRemoteStream(peerId);

		rtcPeerConnection.onconnectionstatechange = (e) => {
			console.log('connectionState', rtcPeerConnection.connectionState);
			if (rtcPeerConnection.connectionState == 'connected') {
				connectedPeers.push(peerId);
				connectedPeers = connectedPeers;
			}
		};
		rtcPeerConnection.onicegatheringstatechange = (e) =>
			console.log('iceGatheringState', rtcPeerConnection.iceGatheringState);
		rtcPeerConnection.oniceconnectionstatechange = (e) => {
			console.log('iceConnectionState', rtcPeerConnection.iceConnectionState);
		};
		rtcPeerConnection.onsignalingstatechange = (e) =>
			console.log('signalingState', rtcPeerConnection.signalingState);

		localStream.getTracks().forEach((track) => {
			rtcPeerConnection.addTrack(track, localStream);
		});

		rtcPeerConnection.ontrack = (event) => {
			event.streams[0].getTracks().forEach((track) => {
				remoteStream.addTrack(track);
			});
		};

		rtcPeerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				rtcPeerConnection.addIceCandidate;
				const newIceCandidateMessage: Message = {
					type: MessageType.NewIceCandidate,
					data: JSON.stringify(event.candidate)
				};
				wsChannel.send(JSON.stringify(newIceCandidateMessage));
			}
		};

		return { peerId: peerId, conn: rtcPeerConnection, remoteStream: remoteStream };
	}

	function copyLink() {
		navigator.clipboard.writeText(
			window.location.protocol + '//' + window.location.host + `/rooms/${roomId}`
		);
		setTimeout(() => {
			tooltipMessage = copyLinkMessage;
		}, 3000);
		tooltipMessage = 'URL copied!';
	}

	function disconnect() {
		wsChannel?.close();
		peerConnections.forEach((c) => c.conn.close());
		localStream.getTracks().forEach(function (track) {
			track.stop();
		});
	}

	function leaveMeeting() {
		disconnect();
		window.location.pathname = '/';
	}
</script>

<div class="my-8 flex items-center gap-2">
	<h1 class="my-0">Meeting ID: {roomId}</h1>
	<button on:click={(e) => copyLink()} class="tooltip" data-tip={tooltipMessage}>
		<Icon icon="radix-icons:copy" class="text-2xl" />
	</button>
</div>
{#if wsConnectionState == WebSocketConnectionState.error}
	<p>Could not join the room.</p>
	<button class="btn btn-primary" on:click={() => (window.location.pathname = '/')}>
		Go to home
	</button>
{:else if wsConnectionState == WebSocketConnectionState.none}
	<button class="btn btn-primary" on:click={setupSignalingChannel}>Join meeting</button>
{:else}
	<div class="flex items-center gap-4">
		<button class="btn btn-error" on:click={leaveMeeting}>Leave meeting</button>
		{#if connectedPeers.length == 0}
			<p>Waiting for other people to join...</p>
		{/if}
	</div>
{/if}
<div
	class="preview-container flex w-full flex-wrap items-center justify-center gap-6"
	class:grid-cols-2={connectedPeers.length > 0}
	bind:this={containerElement}
>
	<video
		class:w-full={connectedPeers.length == 0}
		id="localVideo"
		autoplay
		playsinline
		controls={false}
	>
		<track kind="captions" />
	</video>
</div>
