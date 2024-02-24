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
