export interface Room {
	id: string;
	memberCount: number;
}

export interface PeerConnection {
	peerId: string;
	conn: RTCPeerConnection;
	remoteStream: MediaStream;
}
