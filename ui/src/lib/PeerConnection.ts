import type { Peer } from './Peer';

const servers: RTCConfiguration = {
	iceServers: [
		{
			urls: 'stun:stun1.l.google.com:19302'
		}
	]
};

export class PeerConnection {
	peerId: string;
	private _owner: Peer;
	private _conn: RTCPeerConnection;
	private _remoteStreams: MediaStream[];
	private _iceCandidates: RTCIceCandidate[];
	private _negotiating: boolean;
	private _senderMap: Map<MediaStreamTrack, Map<MediaStream, RTCRtpSender>>;
	private _dataChannel: RTCDataChannel;

	constructor(owner: Peer, peerId: string) {
		this._senderMap = new Map();
		this._remoteStreams = [];
		this.peerId = peerId;
		this._owner = owner;
		this._conn = new RTCPeerConnection(servers);
		this._iceCandidates = [];
		this.setupConnectionListeners();
		this.addStream(this._owner.stream);
		this._negotiating = false;
		this._dataChannel = this.setupDataChannel();
	}

	private setupDataChannel() {
		const dataChannel = this._conn.createDataChannel(this.peerId);
		this._conn.addEventListener('datachannel', (e) => {
			console.log('Received data channel:', e);
			e.channel.addEventListener('open', (e) => console.log('Opened data channel:', e));
			e.channel.addEventListener('message', this._handleDataMessage.bind(this));
			e.channel.addEventListener('close', (e) => console.log('close data channel:', e));
		});
		dataChannel.addEventListener('open', (e) => {
			console.log('Opened data channel:', e);
			this._owner.stream.getAudioTracks().forEach((track) => {
				if (!track.enabled) {
					this.sendDataMessage('muteaudio');
				}
			});
		});
		return dataChannel;
	}

	private _handleDataMessage(event: MessageEvent) {
		console.log('message data channel:', event);
		switch (event.data) {
			case 'muteaudio':
				this._owner.handleMuteAudio(this.peerId);
				break;
			case 'unmuteaudio':
				this._owner.handleUnmuteAudio(this.peerId);
				break;
			default:
				console.log('Message not handled:', event);
				break;
		}
	}

	private setupConnectionListeners() {
		this._conn.onconnectionstatechange = () => {
			console.log('connectionState', this._conn.connectionState);
			if (this._conn.connectionState == 'connected') {
				if (this._owner.screenStream) {
					this.addStream(this._owner.screenStream);
				}
				this._negotiating = false;
			}
		};
		this._conn.onicegatheringstatechange = () =>
			console.log('iceGatheringState', this._conn.iceGatheringState);
		this._conn.oniceconnectionstatechange = () => {
			console.log('iceConnectionState', this._conn.iceConnectionState);
		};
		this._conn.onsignalingstatechange = () => {
			console.log('signalingState', this._conn.signalingState);
			if (this._conn.signalingState == 'stable') {
				this._negotiating = false;
			}
		};
		this._conn.ontrack = (event) => {
			console.log('Received track:', event.track);
			event.streams.forEach((stream) => {
				if (!this._remoteStreams.some((s) => s.id == stream.id)) {
					this._remoteStreams.push(stream);
					this._owner.handleIncomingStream({
						source: this.peerId,
						stream,
						type: this._remoteStreams.length > 1 ? 'screen' : 'video'
					});
					stream.addEventListener('removetrack', ({ track }) => {
						console.log(`${track.kind} track was removed.`);
						if (!stream.getTracks().length) {
							this._remoteStreams = this._remoteStreams.filter((s) => s.id != stream.id);
							this._owner.handleIncomingStreamEnded({
								source: this.peerId,
								stream,
								type: 'screen'
							});
						}
					});
				}
			});
		};
		this._conn.onnegotiationneeded = (ev) => {
			console.log('onnegotiationneeded', this._negotiating, ev, this._conn);
			if (this._negotiating) return;

			this._negotiating = true;
			this._owner.handleCreateOffer(this);
		};
		this._conn.onicecandidate = (event) => {
			if (event.candidate) {
				this._owner.handleNewIceCandidate(event.candidate, this.peerId);
			}
		};
	}

	async createOffer() {
		this._negotiating = true;
		const offer = await this._conn.createOffer();
		await this._conn.setLocalDescription(offer);
		return offer;
	}

	async createAnswer(offer: RTCSessionDescription) {
		this._negotiating = true;
		this._conn.setRemoteDescription(offer);
		const answer = await this._conn.createAnswer();
		await this._conn.setLocalDescription(answer);
		return answer;
	}

	async setAnswer(answer: RTCSessionDescription) {
		if (this._conn.signalingState == 'have-local-offer') {
			await this._conn.setRemoteDescription(answer);
		}
		await this.addNewIceCandidate();
	}
	addTrack(track: MediaStreamTrack, stream: MediaStream) {
		const submap: Map<MediaStream, RTCRtpSender> = this._senderMap.get(track) || new Map();
		let sender = submap.get(stream);

		if (!sender) {
			sender = this._conn.addTrack(track, stream);
			submap.set(stream, sender);
			this._senderMap.set(track, submap);
		}
	}
	removeTrack(track: MediaStreamTrack, stream: MediaStream) {
		const submap: Map<MediaStream, RTCRtpSender> = this._senderMap.get(track) || new Map();
		const sender = submap.get(stream);

		if (sender) {
			this._conn.removeTrack(sender);
			submap.delete(stream);
			this._senderMap.set(track, submap);
		}
	}

	addStream(stream: MediaStream) {
		stream.getTracks().forEach((track) => this.addTrack(track, stream));
	}

	removeStream(stream: MediaStream) {
		stream.getTracks().forEach((track) => this.removeTrack(track, stream));
	}

	async addNewIceCandidate(candidate?: RTCIceCandidate) {
		if (!candidate) {
			for (const c of this._iceCandidates) {
				await this._conn.addIceCandidate(c);
			}
			this._iceCandidates = [];
		} else {
			if (this._conn.remoteDescription) {
				await this._conn.addIceCandidate(candidate);
			} else {
				this._iceCandidates.push(candidate);
			}
		}
	}

	close() {
		this._conn.close();
	}

	sendDataMessage(message: string) {
		this._dataChannel.send(message);
	}
}
