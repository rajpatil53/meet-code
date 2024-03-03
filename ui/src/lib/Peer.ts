import { PeerConnection } from './PeerConnection';
import { Message, MessageType, type SignalingChannel } from './channels/SignalingChannel';

export interface IncomingStream {
	stream: MediaStream;
	source: string;
	type: 'video' | 'screen';
}
export interface PeerEventMap {
	streamadded: CustomEvent<IncomingStream>;
	streamremoved: CustomEvent<IncomingStream>;
	muted: CustomEvent<string>;
	unmuted: CustomEvent<string>;
}

export interface PeerEventTarget extends EventTarget {
	addEventListener<K extends keyof PeerEventMap>(
		type: K,
		listener: (this: Peer, ev: PeerEventMap[K]) => void,
		options?: boolean | AddEventListenerOptions
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions
	): void;
	removeEventListener<K extends keyof PeerEventMap>(
		type: K,
		listener: (this: Peer, ev: PeerEventMap[K]) => void,
		options?: boolean | EventListenerOptions
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions
	): void;
}

const typedEventTarget = EventTarget as { new (): PeerEventTarget; prototype: PeerEventTarget };

export class Peer extends typedEventTarget {
	private _channel: SignalingChannel;
	private _connections: { [peerId: string]: PeerConnection };
	screenStream: MediaStream | null;
	stream: MediaStream;

	constructor(channel: SignalingChannel, stream: MediaStream) {
		super();
		this.stream = stream;
		this.screenStream = null;
		this._channel = channel;

		this._connections = {};

		this.init();
	}

	init() {
		this._channel.init();
		this._addMessageHandler();
		this._channel.addEventListener('open', () => {
			this._channel.sendMessage({ type: MessageType.Join });
		});
		this._channel.addEventListener('error', () => {
			this.dispatchEvent(new Event('error'));
		});
	}

	private _getPeerConnectionFor(peerId: string) {
		if (this._connections[peerId]) {
			return this._connections[peerId];
		}
		this._connections[peerId] = new PeerConnection(this, peerId);
		this.dispatchEvent(new Event('connect'));
		return this._connections[peerId];
	}

	sendMessage(message: Message) {
		this._channel.sendMessage(message);
	}

	get connectedPeers() {
		return Object.keys(this._connections);
	}

	get connections() {
		return Object.values(this._connections);
	}

	close() {
		this._channel.close();
		this.stream.getTracks().forEach(function (track) {
			track.stop();
		});
		Object.values(this._connections).forEach((c) => c.close());
	}

	shareScreen(stream: MediaStream) {
		this.screenStream = stream;
		Object.values(this._connections).forEach((c) => {
			c.addStream(this.screenStream!);
		});
		this.screenStream.getTracks().forEach((track) => {
			track.addEventListener('ended', () => {
				Object.values(this._connections).forEach((c) => {
					c.removeStream(this.screenStream!);
				});
				this.screenStream = null;
			});
		});
	}

	private _addMessageHandler() {
		this._channel!.addEventListener('message', async (event) => {
			const message = event.data;
			console.log(message);
			if (message && message.from) {
				const target = message.from!;
				const peerConnection = this._getPeerConnectionFor(target);
				switch (message.type) {
					case MessageType.Negotiation:
						if (message.data) {
							if (message.data.sdp) {
								const sdp = JSON.parse(message.data.sdp);
								if (sdp.type == 'offer') {
									this.handleSetOffer(peerConnection, sdp);
								} else {
									this.setAnswer(peerConnection, sdp);
								}
							} else if (message.data.candidate) {
								peerConnection.addNewIceCandidate(JSON.parse(message.data.candidate));
							}
						} else {
							this.handleCreateOffer(peerConnection);
						}
						break;
					case MessageType.RemovePeer:
						this.removeConnection(peerConnection);
						break;
					case MessageType.RoomClosed:
						window.location.pathname = '/';
						break;
					default:
						break;
				}
			}
		});
	}

	removeConnection(peerConnection: PeerConnection) {
		if (peerConnection) {
			console.log('Closing: ', peerConnection.peerId);
			peerConnection.close();
			delete this._connections[peerConnection.peerId];
			const video = document.querySelector(`video#${peerConnection.peerId}`);
			video?.parentElement?.remove();
			this.dispatchEvent(new Event('connect'));
		}
	}

	async handleCreateOffer(peerConnection: PeerConnection) {
		const offer = await peerConnection.createOffer();
		this._channel?.sendMessage(
			new Message({
				type: MessageType.Negotiation,
				data: {
					sdp: JSON.stringify(offer)
				},
				to: peerConnection.peerId
			})
		);
	}

	async handleSetOffer(peerConnection: PeerConnection, offer: RTCSessionDescription) {
		const answer = await peerConnection.createAnswer(offer);
		this._channel?.sendMessage(
			new Message({
				type: MessageType.Negotiation,
				data: {
					sdp: JSON.stringify(answer)
				},
				to: peerConnection.peerId
			})
		);
	}

	async handleNewIceCandidate(candidate: RTCIceCandidate, peerId: string) {
		const newIceCandidateMessage: Message = {
			type: MessageType.Negotiation,
			data: {
				candidate: JSON.stringify(candidate)
			},
			to: peerId
		};
		this.sendMessage(newIceCandidateMessage);
	}

	async setAnswer(peerConnection: PeerConnection, answer: RTCSessionDescription) {
		await peerConnection.setAnswer(answer);
	}

	async handleIncomingStream(incomingStream: IncomingStream) {
		console.log('streamadded', incomingStream);
		this.dispatchEvent(new CustomEvent<IncomingStream>('streamadded', { detail: incomingStream }));
	}

	async handleIncomingStreamEnded(incomingStream: IncomingStream) {
		console.log('streamremoved', incomingStream);
		this.dispatchEvent(
			new CustomEvent<IncomingStream>('streamremoved', { detail: incomingStream })
		);
	}

	muteAudio() {
		Object.values(this._connections).forEach((c) => c.sendDataMessage('muteaudio'));
	}
	unmuteAudio() {
		Object.values(this._connections).forEach((c) => c.sendDataMessage('unmuteaudio'));
	}

	handleMuteAudio(peerId: string) {
		this.dispatchEvent(new CustomEvent<string>('muted', { detail: peerId }));
	}
	handleUnmuteAudio(peerId: string) {
		this.dispatchEvent(new CustomEvent<string>('unmuted', { detail: peerId }));
	}
}
