export interface Room {
	id: string;
	memberCount: number;
}
export interface Client {
	id: string;
}

export interface PeerConnection {
	peerId: string;
	conn: RTCPeerConnection;
	remoteStream: MediaStream;
}

export interface DataMessage {
	type: 'mute' | 'unmute' | 'chat';
	message?: string;
}

export interface ChatMessage {
	sender: string;
	text: string;
}

export interface IncomingStream {
	stream: MediaStream;
	source: string;
	type: 'video' | 'screen';
}
