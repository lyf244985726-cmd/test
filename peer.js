class P2PManager {
  constructor() {
    this.peer = null;
    this.connections = [];
    this.hostConn = null;
    this.onMessage = null;
    this.onPeerConnected = null;
    this.onPeerDisconnected = null;
  }

  init(hostMode = false, roomId = null) {
    return new Promise((resolve, reject) => {
      const peerId = hostMode ? roomId : null;
      this.peer = new Peer(peerId);

      this.peer.on('open', (id) => {
        console.log('Peer connected:', id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        reject(err);
      });
    });
  }

  connectToHost(hostId) {
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(hostId);
      
      conn.on('open', () => {
        this.hostConn = conn;
        this.handleConnection(conn);
        resolve(conn);
      });

      conn.on('error', (err) => {
        reject(err);
      });
    });
  }

  handleConnection(conn) {
    this.connections.push(conn);
    
    conn.on('data', (data) => {
      if (this.onMessage) {
        this.onMessage(data, conn);
      }
    });

    conn.on('close', () => {
      this.connections = this.connections.filter(c => c !== conn);
      if (this.onPeerDisconnected) {
        this.onPeerDisconnected(conn.peer);
      }
    });

    if (this.onPeerConnected) {
      this.onPeerConnected(conn);
    }
  }

  send(data, conn = null) {
    if (conn) {
      conn.send(data);
    } else if (this.hostConn) {
      this.hostConn.send(data);
    } else {
      this.connections.forEach(c => c.send(data));
    }
  }

  broadcast(data) {
    this.connections.forEach(c => c.send(data));
    if (this.hostConn) {
      this.hostConn.send(data);
    }
  }

  getConnections() {
    return this.connections;
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy();
    }
  }
}

window.P2PManager = P2PManager;
