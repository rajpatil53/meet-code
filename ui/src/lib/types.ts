export interface Room {
	id: string;
}

export interface PeerConnection {
	peerId: string;
	conn: RTCPeerConnection;
	remoteStream: MediaStream;
}
