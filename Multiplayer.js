import Peer from 'peerjs';

export class Multiplayer {
    constructor(player, onConnect, onDisconnect, onData) {
        this.player = player;
        this.onConnect = onConnect;
        this.onDisconnect = onDisconnect;
        this.onData = onData;
        this.conns = {}

        this.peer = new Peer({
            // For local testing, you can omit host/port. For deployment,
            // you might need to point this to your own PeerJS server.
        });

        this.peer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            this.myId = id;
            if (window.onPeerId) window.onPeerId(id);
        });

        this.peer.on('connection', (conn) => {
            this.setupConnection(conn);
        });
    }

    connect(peerId) {
        if (this.conns[peerId]) {
            console.log(`Already connected to ${peerId}`);
            return;
        }
        console.log(`Connecting to ${peerId}`);
        const conn = this.peer.connect(peerId);
        this.setupConnection(conn);
    }

    setupConnection(conn) {
        conn.on('open', () => {
            console.log(`Connection opened with ${conn.peer}`);
            this.conns[conn.peer] = conn;
            this.onConnect(conn.peer);
        });

        conn.on('data', (data) => {
            this.onData(conn.peer, data);
        });

        conn.on('close', () => {
            console.log(`Connection closed with ${conn.peer}`);
            delete this.conns[conn.peer];
            this.onDisconnect(conn.peer);
        });

        conn.on('error', (err) => {
            console.error(`Connection error with ${conn.peer}:`, err);
            delete this.conns[conn.peer];
            this.onDisconnect(conn.peer);
        });
    }

    sendPlayerData() {
        const playerData = {
            position: this.player.controls.getObject().position,
            rotation: this.player.controls.getObject().rotation,
        };
        for (const peerId in this.conns) {
            this.conns[peerId].send(playerData);
        }
    }
}