import { PeerConnection } from './PeerConnection';
import { Message, MessageType, type SignalingChannel } from './channels/SignalingChannel';

export class Peer extends EventTarget {
	private _channel: SignalingChannel;
	private _stream: MediaStream;
	private _connections: { [peerId: string]: PeerConnection };

	constructor(channel: SignalingChannel, stream: MediaStream) {
		super();
		this._stream = stream;
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

	get localStream() {
		return this._stream;
	}

	get connectedPeers() {
		return Object.keys(this._connections);
	}

	close() {
		this._channel.close();
		this._stream.getTracks().forEach(function (track) {
			track.stop();
		});
		Object.values(this._connections).forEach((c) => c.conn.close());
	}

	private _addMessageHandler() {
		this._channel!.addEventListener('message', async (event) => {
			const message = event.data;
			console.log(message);
			if (message) {
				switch (message.type) {
					case MessageType.CreateOffer:
						this.createAndShareOffer(message.from!);
						break;
					case MessageType.SetOffer:
						this.createAndShareAnswer(message.from!, JSON.parse(message.data!));
						break;
					case MessageType.SetAnswer:
						this.setAnswer(message.from!, JSON.parse(message.data!));
						break;
					case MessageType.AddIceCandidate:
						this.addNewIceCandidate(message.from!, JSON.parse(message.data!));
						break;
					case MessageType.RemovePeer:
						this.removeConnection(message.data!);
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

	removeConnection(peerId: string) {
		console.log();
		const peerConnection = this._getPeerConnectionFor(peerId);
		if (peerConnection) {
			console.log('Closing: ', peerId);
			peerConnection.conn.close();
			delete this._connections[peerId];
			const video = document.querySelector(`video#${peerId}`);
			video?.parentElement?.remove();
			this.dispatchEvent(new Event('connect'));
		}
	}

	async addNewIceCandidate(peerId: string, candidate?: RTCIceCandidate) {
		const peerConnection = this._getPeerConnectionFor(peerId);
		peerConnection.addNewIceCandidate(candidate);
	}

	async createAndShareOffer(peerId: string) {
		const peerConnection = this._getPeerConnectionFor(peerId);
		const offer = await peerConnection.conn.createOffer();
		await peerConnection.conn.setLocalDescription(offer);
		this._channel?.sendMessage(
			new Message({
				type: MessageType.Offer,
				data: JSON.stringify(offer),
				to: peerId
			})
		);
	}

	async createAndShareAnswer(peerId: string, offer: RTCSessionDescription) {
		const peerConnection = this._getPeerConnectionFor(peerId);
		peerConnection.conn.setRemoteDescription(offer);
		const answer = await peerConnection.conn.createAnswer();
		await peerConnection.conn.setLocalDescription(answer);
		this._channel?.sendMessage(
			new Message({
				type: MessageType.Answer,
				data: JSON.stringify(answer),
				to: peerId
			})
		);
	}

	async setAnswer(peerId: string, answer: RTCSessionDescription) {
		const peerConnection = this._getPeerConnectionFor(peerId);
		if (peerConnection.conn.signalingState == 'have-local-offer') {
			await peerConnection.conn.setRemoteDescription(answer);
			await this.addNewIceCandidate(peerId);
		}
	}
}
