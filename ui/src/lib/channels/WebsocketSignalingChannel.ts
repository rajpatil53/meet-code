import { PUBLIC_WS_BASE_URL } from '$env/static/public';
import {
	type ChannelEventMap,
	type Message,
	type SignalingChannel,
	ChannelMessageEvent
} from './SignalingChannel';

export class WebsocketSignalingChannel extends EventTarget implements SignalingChannel {
	private _roomId: string;
	private _channel?: WebSocket;
	private _messageListener?: (e: MessageEvent) => void;

	constructor(roomId: string) {
		super();
		this._roomId = roomId;
	}

	init() {
		this._channel = new WebSocket(`${PUBLIC_WS_BASE_URL}/rooms/${this._roomId}`);
		this._channel.addEventListener('open', (e) => console.log('Ws Opened:', e));
		this._channel.addEventListener('close', (e) => console.log('WS Closed:', e));
		this._channel.addEventListener('error', (e) => console.log('WS Error:', e));
		this._channel.addEventListener('message', (e) => console.log('WS Received message:', e));
	}

	close(): void {
		this._channel?.close();
	}

	sendMessage(message: Message): void {
		this._channel?.send(JSON.stringify(message));
	}

	onMessage<K extends keyof ChannelEventMap>(
		e: MessageEvent,
		listener: (ev: ChannelEventMap[K]) => void
	) {
		const messageEvent = new ChannelMessageEvent(e.type, { data: JSON.parse(e.data) });
		listener(messageEvent);
	}

	addEventListener<K extends keyof ChannelEventMap>(
		type: K,
		listener: (ev: ChannelEventMap[K]) => void
	) {
		if (type == 'message') {
			this._messageListener = (e) => this.onMessage(e, listener);
			this._channel?.addEventListener('message', this._messageListener);
		} else {
			this._channel?.addEventListener(type, listener);
		}
	}

	removeEventListener<K extends keyof ChannelEventMap>(
		type: K,
		listener: (ev: ChannelEventMap[K]) => void
	) {
		if (type == 'message' && this._messageListener) {
			this._channel?.removeEventListener('message', this._messageListener);
		} else {
			this._channel?.removeEventListener(type, listener);
		}
	}
}
