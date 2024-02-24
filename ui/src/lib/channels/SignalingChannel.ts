export enum MessageType {
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

export class Message {
	type: MessageType;
	from?: string;
	data?: string;
	to?: string;

	constructor({
		type,
		data,
		from,
		to
	}: {
		type: MessageType;
		data?: string;
		from?: string;
		to?: string;
	}) {
		this.type = type;
		this.data = data;
		this.from = from;
		this.to = to;
	}
}

export class ChannelMessageEvent<T> extends MessageEvent<T> {
	constructor(type: string, eventInitDict?: MessageEventInit<T> | undefined) {
		super(type, { ...eventInitDict });
	}
}

export interface ChannelEventMap {
	close: Event;
	error: Event;
	message: ChannelMessageEvent<Message>;
	open: Event;
}

export interface SignalingChannel extends EventTarget {
	init(): void;
	sendMessage(message: Message): void;
	addEventListener<K extends keyof ChannelEventMap>(
		type: K,
		listener: (ev: ChannelEventMap[K]) => void
	): void;
	removeEventListener<K extends keyof ChannelEventMap>(
		type: K,
		listener: (ev: ChannelEventMap[K]) => void
	): void;
	close(): void;
}
