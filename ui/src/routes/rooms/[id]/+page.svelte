<script lang="ts">
	import type { PeerConnection, Room } from '$lib/types';
	import { onDestroy, onMount } from 'svelte';
	import type { PageData } from './$types';
	import { PUBLIC_WS_BASE_URL } from '$env/static/public';

	export let data: PageData;
	const { roomId } = data;

	let peerConnections: PeerConnection[] = [];
	let wsChannel: WebSocket;
	let localStream: MediaStream;
	let wsConnectionError: string;

	onMount(setupLocalStream);

	onDestroy(() => {
		wsChannel?.close();
		peerConnections.forEach((c) => c.conn.close());
		localStream.getTracks().forEach(function (track) {
			track.stop();
		});
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
		console.log(peerConnections);
		const peerConnection = peerConnections.find((c) => c.peerId == peerId);
		if (!peerConnection) {
			const newConnection = setupPeerConnection(peerId);
			console.log('Created new connection for: ', peerId);
			peerConnections.push(newConnection);
			peerConnections = peerConnections;
			console.log(peerConnections);
			return newConnection.conn;
		}
		return peerConnection!.conn;
	}

	function removeConnection(peerId: string) {
		console.log('Removing: ', peerId);
		const connection = peerConnections.find((c) => c.peerId == peerId);
		if (connection) {
			connection.conn.close();
			peerConnections = peerConnections.filter((c) => c.peerId === connection.peerId);
			const video = document.querySelector(`video#${peerId}`);
			video?.remove();
		}
	}

	async function setupLocalStream() {
		localStream = await window.navigator.mediaDevices.getUserMedia({ video: true, audio: true });
		const localVideoStream = await window.navigator.mediaDevices.getUserMedia({ video: true });

		const localVideo: HTMLVideoElement | null = document.getElementById(
			'localVideo'
		) as HTMLVideoElement;
		if (localVideo) {
			localVideo.srcObject = localVideoStream;
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
		remoteVideo.width = 150;
		if (remoteVideo) {
			remoteVideo.srcObject = remoteStream;
		}
		localVideo.parentElement?.appendChild(remoteVideo);
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
				console.log('Adding new ice candidate', candidate);
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
					console.log('Sending Offer', peerConnection);
					const offerMessage: Message = {
						type: MessageType.Offer,
						data: JSON.stringify(offer),
						to: message.from
					};
					console.log('offerMessage', offerMessage);
					wsChannel.send(JSON.stringify(offerMessage));
					break;
				case MessageType.SetOffer:
					peerConnection = getPeerConnectionFor(message.from!);
					peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(message.data!)));
					const answer = await peerConnection.createAnswer();
					await peerConnection.setLocalDescription(answer);
					console.log('Setting Answer', peerConnection);
					const answerMessage: Message = {
						type: MessageType.Answer,
						data: JSON.stringify(answer),
						to: message.from
					};
					console.log('answerMessage', answerMessage);
					wsChannel.send(JSON.stringify(answerMessage));
					break;
				case MessageType.SetAnswer:
					peerConnection = getPeerConnectionFor(message.from!);
					console.log('before remoteDescription', peerConnection.remoteDescription);
					if (peerConnection.signalingState == 'have-local-offer') {
						await peerConnection.setRemoteDescription(
							new RTCSessionDescription(JSON.parse(message.data!))
						);
						console.log('Setting Answer', peerConnection);
						await addNewIceCandidate(peerConnection);
					}
					console.log('after remoteDescription', peerConnection.remoteDescription);
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
		});
		wsChannel.addEventListener('close', (event) => {
			console.log('Closed: ', event);
		});
		wsChannel.addEventListener('error', (event) => {
			console.log('Error: ', event);
			wsConnectionError = 'Could not join the room.';
		});
	}

	function setupPeerConnection(peerId: string): PeerConnection {
		const rtcPeerConnection = new RTCPeerConnection(servers);
		const remoteStream = setupRemoteStream(peerId);
		console.log('Setting up peerConnection', rtcPeerConnection);

		rtcPeerConnection.onconnectionstatechange = (e) =>
			console.log('connectionState', rtcPeerConnection.connectionState, rtcPeerConnection);
		rtcPeerConnection.onicegatheringstatechange = (e) =>
			console.log('iceGatheringState', rtcPeerConnection.iceGatheringState, rtcPeerConnection);
		rtcPeerConnection.oniceconnectionstatechange = (e) => {
			console.log('iceConnectionState', rtcPeerConnection.iceConnectionState, rtcPeerConnection);
		};
		rtcPeerConnection.onsignalingstatechange = (e) =>
			console.log('signalingState', rtcPeerConnection.signalingState, rtcPeerConnection);

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
				console.log('New candidate', event.candidate);
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
</script>

<h1>{roomId}</h1>
{#if wsConnectionError}
	<p>{wsConnectionError}</p>
	<button class="btn btn-primary" on:click={() => window.history.back()}>Go back</button>
{:else}
	<button class="btn btn-primary" on:click={setupSignalingChannel}>Join</button>
{/if}
<div class="grid grid-cols-2">
	<video width="150" id="localVideo" autoplay playsinline controls={false}></video>
</div>
