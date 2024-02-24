import type { Peer } from './Peer';
import { Message, MessageType } from './channels/SignalingChannel';

const servers: RTCConfiguration = {
	iceServers: [
		{
			urls: 'stun:stun1.l.google.com:19302'
		}
	]
};

export class PeerConnection {
	private _owner: Peer;
	private _conn: RTCPeerConnection;
	private _remoteStream: MediaStream;
	private _iceCandidates: RTCIceCandidate[];

	constructor(owner: Peer, peerId: string) {
		this._owner = owner;
		this._conn = new RTCPeerConnection(servers);
		this._remoteStream = this.setupRemoteStream(peerId);
		this._iceCandidates = [];
		this.setupConnectionListeners();
		this.addTracks(this._owner.localStream);
	}

	get conn() {
		return this._conn;
	}

	private setupConnectionListeners() {
		this._conn.onconnectionstatechange = () => {
			console.log('connectionState', this._conn.connectionState);
		};
		this._conn.onicegatheringstatechange = () =>
			console.log('iceGatheringState', this._conn.iceGatheringState);
		this._conn.oniceconnectionstatechange = () => {
			console.log('iceConnectionState', this._conn.iceConnectionState);
		};
		this._conn.onsignalingstatechange = () =>
			console.log('signalingState', this._conn.signalingState);
		this._conn.ontrack = (event) => {
			event.streams[0].getTracks().forEach((track) => {
				this._remoteStream.addTrack(track);
			});
		};

		this._conn.onicecandidate = (event) => {
			if (event.candidate) {
				this._conn.addIceCandidate;
				const newIceCandidateMessage: Message = {
					type: MessageType.NewIceCandidate,
					data: JSON.stringify(event.candidate)
				};
				this._owner.sendMessage(newIceCandidateMessage);
			}
		};
	}

	addTracks(stream: MediaStream) {
		stream.getTracks().forEach((track) => {
			this._conn.addTrack(track, stream);
		});
	}

	setupRemoteStream(peerId: string): MediaStream {
		const remoteStream = new MediaStream();

		const localVideo: HTMLVideoElement | null = document.getElementById(
			'localVideo'
		) as HTMLVideoElement;
		const remoteVideoContainer = document.createElement('div');
		remoteVideoContainer.classList.add('video-container');
		const remoteVideo = document.createElement('video');
		remoteVideo.id = peerId;
		remoteVideo.autoplay = true;
		remoteVideo.playsInline = true;
		remoteVideo.controls = false;
		console.log('remoteVideo', remoteVideo.width, remoteVideo.height);
		remoteVideo.classList.add('not-prose');
		if (remoteVideo) {
			remoteVideo.srcObject = remoteStream;
		}
		remoteVideoContainer.appendChild(remoteVideo);
		localVideo.parentElement?.parentElement?.prepend(remoteVideoContainer);
		return remoteStream;
	}

	async addNewIceCandidate(candidate?: RTCIceCandidate) {
		if (!candidate) {
			this._iceCandidates.forEach((c) => {
				this.conn.addIceCandidate(c);
			});
			this._iceCandidates = [];
		} else {
			if (this._conn.remoteDescription) {
				await this._conn.addIceCandidate(candidate);
			} else {
				this._iceCandidates.push(candidate);
			}
		}
	}
}
