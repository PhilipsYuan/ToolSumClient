import require$$0 from 'events';
import require$$2$2 from 'path';
import require$$2$4 from 'simple-concat';
import require$$3$4 from './create-torrent';
import require$$1$1 from 'debug';
import require$$5$2 from './bittorrent-dht-client';
import require$$6 from 'load-ip-set';
import require$$18 from 'run-parallel';
import require$$20 from './parse-torrent';
import require$$9$2 from 'simple-peer';
import require$$2$1 from 'queue-microtask';
import require$$11$1 from './randombytes';
import require$$4$2 from './simple-sha1';
import require$$26 from 'throughput';
import require$$14$1 from 'speed-limiter';
import require$$0$1 from 'net';
import require$$1 from 'stream';
import require$$2 from 'unordered-array-remove';
import require$$4 from './bittorrent-protocol';
import require$$1$3 from 'fs';
import require$$3$3 from 'os';
import require$$5$1 from 'addr-to-ip-port';
import require$$0$4 from './bitfield';
import require$$7$1 from 'cache-chunk-store';
import require$$8$1 from 'chunk-store-stream/write';
import require$$9$1 from 'cpus';
import require$$11 from './torrent-discovery';
import require$$12 from './fs-chunk-store';
import require$$2$3 from 'simple-get';
import require$$14 from 'immediate-chunk-store';
import require$$3$2 from 'lt_donthave';
import require$$16 from 'memory-chunk-store';
import require$$17 from 'join-async-iterator';
import require$$19 from 'run-parallel-limit';
import require$$21 from 'torrent-piece';
import require$$3$1 from 'pump';
import require$$24 from 'random-iterate';
import require$$27 from './ut_metadata';
import require$$28 from 'ut_pex';
import require$$0$2 from 'streamx';
import require$$3 from 'render-media';
import require$$4$1 from 'fast-blob-stream';
import require$$5 from 'stream-with-known-length-to-buffer';
import require$$7 from 'range-parser';
import require$$8 from 'mime';
import require$$9 from 'end-of-stream';
import require$$0$3 from 'http';
import require$$1$2 from 'escape-html';

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var peer = {};

var hasRequiredPeer;

function requirePeer () {
	if (hasRequiredPeer) return peer;
	hasRequiredPeer = 1;
	const EventEmitter = require$$0;
	const { Transform } = require$$1;
	const arrayRemove = require$$2;
	const debugFactory = require$$1$1;
	const Wire = require$$4;

	const CONNECT_TIMEOUT_TCP = 5000;
	const CONNECT_TIMEOUT_UTP = 5000;
	const CONNECT_TIMEOUT_WEBRTC = 25000;
	const HANDSHAKE_TIMEOUT = 25000;
	const debug = debugFactory('webtorrent:peer');

	let secure = false;

	peer.enableSecure = () => {
	  secure = true;
	};

	/**
	 * WebRTC peer connections start out connected, because WebRTC peers require an
	 * "introduction" (i.e. WebRTC signaling), and there's no equivalent to an IP address
	 * that lets you refer to a WebRTC endpoint.
	 */
	peer.createWebRTCPeer = (conn, swarm, throttleGroups) => {
	  const peer = new Peer(conn.id, 'webrtc');
	  peer.conn = conn;
	  peer.swarm = swarm;
	  peer.throttleGroups = throttleGroups;

	  if (peer.conn.connected) {
	    peer.onConnect();
	  } else {
	    const cleanup = () => {
	      peer.conn.removeListener('connect', onConnect);
	      peer.conn.removeListener('error', onError);
	    };
	    const onConnect = () => {
	      cleanup();
	      peer.onConnect();
	    };
	    const onError = err => {
	      cleanup();
	      peer.destroy(err);
	    };
	    peer.conn.once('connect', onConnect);
	    peer.conn.once('error', onError);
	    peer.startConnectTimeout();
	  }

	  return peer
	};

	/**
	 * Incoming TCP peers start out connected, because the remote peer connected to the
	 * listening port of the TCP server. Until the remote peer sends a handshake, we don't
	 * know what swarm the connection is intended for.
	 */
	peer.createTCPIncomingPeer = (conn, throttleGroups) => {
	  return _createIncomingPeer(conn, 'tcpIncoming', throttleGroups)
	};

	/**
	 * Incoming uTP peers start out connected, because the remote peer connected to the
	 * listening port of the uTP server. Until the remote peer sends a handshake, we don't
	 * know what swarm the connection is intended for.
	 */
	peer.createUTPIncomingPeer = (conn, throttleGroups) => {
	  return _createIncomingPeer(conn, 'utpIncoming', throttleGroups)
	};

	/**
	 * Outgoing TCP peers start out with just an IP address. At some point (when there is an
	 * available connection), the client can attempt to connect to the address.
	 */
	peer.createTCPOutgoingPeer = (addr, swarm, throttleGroups) => {
	  return _createOutgoingPeer(addr, swarm, 'tcpOutgoing', throttleGroups)
	};

	/**
	 * Outgoing uTP peers start out with just an IP address. At some point (when there is an
	 * available connection), the client can attempt to connect to the address.
	 */
	peer.createUTPOutgoingPeer = (addr, swarm, throttleGroups) => {
	  return _createOutgoingPeer(addr, swarm, 'utpOutgoing', throttleGroups)
	};

	const _createIncomingPeer = (conn, type, throttleGroups) => {
	  const addr = `${conn.remoteAddress}:${conn.remotePort}`;
	  const peer = new Peer(addr, type);
	  peer.conn = conn;
	  peer.addr = addr;
	  peer.throttleGroups = throttleGroups;

	  peer.onConnect();

	  return peer
	};

	const _createOutgoingPeer = (addr, swarm, type, throttleGroups) => {
	  const peer = new Peer(addr, type);
	  peer.addr = addr;
	  peer.swarm = swarm;
	  peer.throttleGroups = throttleGroups;

	  return peer
	};

	/**
	 * Peer that represents a Web Seed (BEP17 / BEP19).
	 */
	peer.createWebSeedPeer = (conn, id, swarm, throttleGroups) => {
	  const peer = new Peer(id, 'webSeed');
	  peer.swarm = swarm;
	  peer.conn = conn;
	  peer.throttleGroups = throttleGroups;

	  peer.onConnect();

	  return peer
	};

	/**
	 * Peer. Represents a peer in the torrent swarm.
	 *
	 * @param {string} id "ip:port" string, peer id (for WebRTC peers), or url (for Web Seeds)
	 * @param {string} type the type of the peer
	 */
	class Peer extends EventEmitter {
	  constructor (id, type) {
	    super();

	    this.id = id;
	    this.type = type;

	    debug('new %s Peer %s', type, id);

	    this.addr = null;
	    this.conn = null;
	    this.swarm = null;
	    this.wire = null;

	    this.connected = false;
	    this.destroyed = false;
	    this.timeout = null; // handshake timeout
	    this.retries = 0; // outgoing TCP connection retry count

	    this.sentPe1 = false;
	    this.sentPe2 = false;
	    this.sentPe3 = false;
	    this.sentPe4 = false;
	    this.sentHandshake = false;
	  }

	  /**
	   * Called once the peer is connected (i.e. fired 'connect' event)
	   * @param {Socket} conn
	   */
	  onConnect () {
	    if (this.destroyed) return
	    this.connected = true;

	    debug('Peer %s connected', this.id);

	    clearTimeout(this.connectTimeout);

	    const conn = this.conn;
	    conn.once('end', () => {
	      this.destroy();
	    });
	    conn.once('close', () => {
	      this.destroy();
	    });
	    conn.once('finish', () => {
	      this.destroy();
	    });
	    conn.once('error', err => {
	      this.destroy(err);
	    });

	    const wire = this.wire = new Wire(this.type, this.retries, secure);

	    wire.once('end', () => {
	      this.destroy();
	    });
	    wire.once('close', () => {
	      this.destroy();
	    });
	    wire.once('finish', () => {
	      this.destroy();
	    });
	    wire.once('error', err => {
	      this.destroy(err);
	    });

	    wire.once('pe1', () => {
	      this.onPe1();
	    });
	    wire.once('pe2', () => {
	      this.onPe2();
	    });
	    wire.once('pe3', () => {
	      this.onPe3();
	    });
	    wire.once('pe4', () => {
	      this.onPe4();
	    });
	    wire.once('handshake', (infoHash, peerId) => {
	      this.onHandshake(infoHash, peerId);
	    });
	    this.startHandshakeTimeout();

	    this.setThrottlePipes();

	    if (this.swarm) {
	      if (this.type === 'tcpOutgoing') {
	        if (secure && this.retries === 0 && !this.sentPe1) this.sendPe1();
	        else if (!this.sentHandshake) this.handshake();
	      } else if (this.type !== 'tcpIncoming' && !this.sentHandshake) this.handshake();
	    }
	  }

	  sendPe1 () {
	    this.wire.sendPe1();
	    this.sentPe1 = true;
	  }

	  onPe1 () {
	    this.sendPe2();
	  }

	  sendPe2 () {
	    this.wire.sendPe2();
	    this.sentPe2 = true;
	  }

	  onPe2 () {
	    this.sendPe3();
	  }

	  sendPe3 () {
	    this.wire.sendPe3(this.swarm.infoHash);
	    this.sentPe3 = true;
	  }

	  onPe3 (infoHashHash) {
	    if (this.swarm) {
	      if (this.swarm.infoHashHash !== infoHashHash) {
	        this.destroy(new Error('unexpected crypto handshake info hash for this swarm'));
	      }
	      this.sendPe4();
	    }
	  }

	  sendPe4 () {
	    this.wire.sendPe4(this.swarm.infoHash);
	    this.sentPe4 = true;
	  }

	  onPe4 () {
	    if (!this.sentHandshake) this.handshake();
	  }

	  clearPipes () {
	    this.conn.unpipe();
	    this.wire.unpipe();
	  }

	  setThrottlePipes () {
	    const self = this;
	    this.conn
	      .pipe(this.throttleGroups.down.throttle())
	      .pipe(new Transform({
	        transform (chunk, _, callback) {
	          self.emit('download', chunk.length);
	          if (self.destroyed) return
	          callback(null, chunk);
	        }
	      }))
	      .pipe(this.wire)
	      .pipe(this.throttleGroups.up.throttle())
	      .pipe(new Transform({
	        transform (chunk, _, callback) {
	          self.emit('upload', chunk.length);
	          if (self.destroyed) return
	          callback(null, chunk);
	        }
	      }))
	      .pipe(this.conn);
	  }

	  /**
	   * Called when handshake is received from remote peer.
	   * @param {string} infoHash
	   * @param {string} peerId
	   */
	  onHandshake (infoHash, peerId) {
	    if (!this.swarm) return // `this.swarm` not set yet, so do nothing
	    if (this.destroyed) return

	    if (this.swarm.destroyed) {
	      return this.destroy(new Error('swarm already destroyed'))
	    }
	    if (infoHash !== this.swarm.infoHash) {
	      return this.destroy(new Error('unexpected handshake info hash for this swarm'))
	    }
	    if (peerId === this.swarm.peerId) {
	      return this.destroy(new Error('refusing to connect to ourselves'))
	    }

	    debug('Peer %s got handshake %s', this.id, infoHash);

	    clearTimeout(this.handshakeTimeout);

	    this.retries = 0;

	    let addr = this.addr;
	    if (!addr && this.conn.remoteAddress && this.conn.remotePort) {
	      addr = `${this.conn.remoteAddress}:${this.conn.remotePort}`;
	    }
	    this.swarm._onWire(this.wire, addr);

	    // swarm could be destroyed in user's 'wire' event handler
	    if (!this.swarm || this.swarm.destroyed) return

	    if (!this.sentHandshake) this.handshake();
	  }

	  handshake () {
	    const opts = {
	      dht: this.swarm.private ? false : !!this.swarm.client.dht,
	      fast: true
	    };
	    this.wire.handshake(this.swarm.infoHash, this.swarm.client.peerId, opts);
	    this.sentHandshake = true;
	  }

	  startConnectTimeout () {
	    clearTimeout(this.connectTimeout);

	    const connectTimeoutValues = {
	      webrtc: CONNECT_TIMEOUT_WEBRTC,
	      tcpOutgoing: CONNECT_TIMEOUT_TCP,
	      utpOutgoing: CONNECT_TIMEOUT_UTP
	    };

	    this.connectTimeout = setTimeout(() => {
	      this.destroy(new Error('connect timeout'));
	    }, connectTimeoutValues[this.type]);
	    if (this.connectTimeout.unref) this.connectTimeout.unref();
	  }

	  startHandshakeTimeout () {
	    clearTimeout(this.handshakeTimeout);
	    this.handshakeTimeout = setTimeout(() => {
	      this.destroy(new Error('handshake timeout'));
	    }, HANDSHAKE_TIMEOUT);
	    if (this.handshakeTimeout.unref) this.handshakeTimeout.unref();
	  }

	  destroy (err) {
	    if (this.destroyed) return
	    this.destroyed = true;
	    this.connected = false;

	    debug('destroy %s %s (error: %s)', this.type, this.id, err && (err.message || err));

	    clearTimeout(this.connectTimeout);
	    clearTimeout(this.handshakeTimeout);

	    const swarm = this.swarm;
	    const conn = this.conn;
	    const wire = this.wire;

	    this.swarm = null;
	    this.conn = null;
	    this.wire = null;

	    if (swarm && wire) {
	      arrayRemove(swarm.wires, swarm.wires.indexOf(wire));
	    }
	    if (conn) {
	      conn.on('error', () => {});
	      conn.destroy();
	    }
	    if (wire) wire.destroy();
	    if (swarm) swarm.removePeer(this.id);
	  }
	}
	return peer;
}

var utp$2 = (() => {
  try {
    return require('utp-native')
  } catch (err) {
    console.warn('WebTorrent: uTP not supported');
    return {}
  }
})();

const net$1 = require$$0$1; // browser exclude
const debugFactory$4 = require$$1$1;
const queueMicrotask$4 = require$$2$1;

const Peer$2 = requirePeer();
const utp$1 = utp$2; // browser exclude

const debug$4 = debugFactory$4('webtorrent:conn-pool');

/**
 * Connection Pool
 *
 * A connection pool allows multiple swarms to listen on the same TCP/UDP port and determines
 * which swarm incoming connections are intended for by inspecting the bittorrent
 * handshake that the remote peer sends.
 *
 * @param {number} port
 */
let ConnPool$1 = class ConnPool {
  constructor (client) {
    debug$4('create pool (port %s)', client.torrentPort);

    this._client = client;

    // Temporarily store incoming connections so they can be destroyed if the server is
    // closed before the connection is passed off to a Torrent.
    this._pendingConns = new Set();

    this._onTCPConnectionBound = (conn) => {
      this._onConnection(conn, 'tcp');
    };

    this._onUTPConnectionBound = (conn) => {
      this._onConnection(conn, 'utp');
    };

    this._onListening = () => {
      this._client._onListening();
    };

    this._onTCPError = (err) => {
      this._client._destroy(err);
    };

    this._onUTPError = () => {
      this._client.utp = false;
    };

    // Setup TCP
    this.tcpServer = net$1.createServer();
    this.tcpServer.on('connection', this._onTCPConnectionBound);
    this.tcpServer.on('error', this._onTCPError);

    // Start TCP
    this.tcpServer.listen(client.torrentPort, () => {
      debug$4('creating tcpServer in port %s', this.tcpServer.address().port);
      if (this._client.utp) {
        // Setup uTP
        this.utpServer = utp$1.createServer();
        this.utpServer.on('connection', this._onUTPConnectionBound);
        this.utpServer.on('listening', this._onListening);
        this.utpServer.on('error', this._onUTPError);

        // Start uTP
        debug$4('creating utpServer in port %s', this.tcpServer.address().port);
        this.utpServer.listen(this.tcpServer.address().port);
      } else {
        this._onListening();
      }
    });
  }

  /**
   * Destroy this Conn pool.
   * @param  {function} cb
   */
  destroy (cb) {
    debug$4('destroy conn pool');

    if (this.utpServer) {
      this.utpServer.removeListener('connection', this._onUTPConnectionBound);
      this.utpServer.removeListener('listening', this._onListening);
      this.utpServer.removeListener('error', this._onUTPError);
    }

    this.tcpServer.removeListener('connection', this._onTCPConnectionBound);
    this.tcpServer.removeListener('error', this._onTCPError);

    // Destroy all open connection objects so server can close gracefully without waiting
    // for connection timeout or remote peer to disconnect.
    this._pendingConns.forEach((conn) => {
      conn.on('error', noop$1);
      conn.destroy();
    });

    if (this.utpServer) {
      try {
        this.utpServer.close(cb);
      } catch (err) {
        if (cb) queueMicrotask$4(cb);
      }
    }

    try {
      this.tcpServer.close(cb);
    } catch (err) {
      if (cb) queueMicrotask$4(cb);
    }

    this.tcpServer = null;
    this.utpServer = null;
    this._client = null;
    this._pendingConns = null;
  }

  /**
   * On incoming connections, we expect the remote peer to send a handshake first. Based
   * on the infoHash in that handshake, route the peer to the right swarm.
   */
  _onConnection (conn, type) {
    const self = this;

    // If the connection has already been closed before the `connect` event is fired,
    // then `remoteAddress` will not be available, and we can't use this connection.
    // - Node.js issue: https://github.com/nodejs/node-v0.x-archive/issues/7566
    // - WebTorrent issue: https://github.com/webtorrent/webtorrent/issues/398
    if (!conn.remoteAddress) {
      conn.on('error', noop$1);
      conn.destroy();
      return
    }

    self._pendingConns.add(conn);
    conn.once('close', cleanupPending);

    const peer = type === 'utp'
      ? Peer$2.createUTPIncomingPeer(conn, this._client.throttleGroups)
      : Peer$2.createTCPIncomingPeer(conn, this._client.throttleGroups);

    const wire = peer.wire;
    wire.once('pe3', onPe3);
    wire.once('handshake', onHandshake);

    function onPe3 (infoHashHash) {
      const torrent = self._client._getByHash(infoHashHash);
      if (torrent) {
        peer.swarm = torrent;
        torrent._addIncomingPeer(peer);
        peer.onPe3(infoHashHash);
      } else {
        peer.destroy(new Error(`Unexpected info hash hash ${infoHashHash} from incoming peer ${peer.id}`));
      }
    }

    function onHandshake (infoHash, peerId) {
      cleanupPending();

      const torrent = self._client.get(infoHash);
      // only add incoming peer if didn't already do so in protocol encryption handshake
      if (torrent) {
        if (!peer.swarm) {
          peer.swarm = torrent;
          torrent._addIncomingPeer(peer);
        }
        peer.onHandshake(infoHash, peerId);
      } else {
        const err = new Error(
          `Unexpected info hash ${infoHash} from incoming peer ${peer.id}`
        );
        peer.destroy(err);
      }
    }

    function cleanupPending () {
      conn.removeListener('close', cleanupPending);
      wire.removeListener('handshake', onHandshake);
      if (self._pendingConns) {
        self._pendingConns.delete(conn);
      }
    }
  }
};

ConnPool$1.UTP_SUPPORT = Object.keys(utp$1).length > 0;

function noop$1 () {}

var connPool = ConnPool$1;

const { Readable: Readable$1 } = require$$0$2;
const debugFactory$3 = require$$1$1;

const debug$3 = debugFactory$3('webtorrent:file-stream');

/**
 * Readable stream of a torrent file
 *
 * @param {File} file
 * @param {Object} opts
 * @param {number} opts.start stream slice of file, starting from this byte (inclusive)
 * @param {number} opts.end stream slice of file, ending with this byte (inclusive)
 */
let FileStream$1 = class FileStream extends Readable$1 {
  constructor (file, opts) {
    super(opts ?? {});

    this._torrent = file._torrent;

    const start = (opts && opts.start) || 0;
    const end = (opts && opts.end && opts.end < file.length)
      ? opts.end
      : file.length - 1;

    const pieceLength = file._torrent.pieceLength;

    this._startPiece = (start + file.offset) / pieceLength | 0;
    this._endPiece = (end + file.offset) / pieceLength | 0;

    this._piece = this._startPiece;
    this._offset = (start + file.offset) - (this._startPiece * pieceLength);

    this._missing = end - start + 1;
    this._reading = false;
    this._notifying = false;
    this._criticalLength = Math.min((1024 * 1024 / pieceLength) | 0, 2);

    this._torrent.select(this._startPiece, this._endPiece, true, () => {
      this._notify();
    });
  }

  _read (cb) {
    if (this._reading) return
    this._reading = true;
    this._notify(cb);
  }

  _notify (cb = () => {}) {
    if (!this._reading || this._missing === 0) return cb()
    if (!this._torrent.bitfield.get(this._piece)) {
      cb();
      return this._torrent.critical(this._piece, this._piece + this._criticalLength)
    }

    if (this._notifying) return cb()
    this._notifying = true;

    if (this._torrent.destroyed) return this.destroy(new Error('Torrent removed'))

    const p = this._piece;

    const getOpts = {};
    // Specify length for the last piece in case it is zero-padded
    if (p === this._torrent.pieces.length - 1) {
      getOpts.length = this._torrent.lastPieceLength;
    }
    this._torrent.store.get(p, getOpts, (err, buffer) => {
      this._notifying = false;
      if (this.destroyed) return
      debug$3('read %s (length %s) (err %s)', p, buffer && buffer.length, err && err.message);

      if (err) return this.destroy(err)

      if (this._offset) {
        buffer = buffer.slice(this._offset);
        this._offset = 0;
      }

      if (this._missing < buffer.length) {
        buffer = buffer.slice(0, this._missing);
      }
      this._missing -= buffer.length;

      debug$3('pushing buffer of length %s', buffer.length);
      this._reading = false;
      this.push(buffer);

      if (this._missing === 0) this.push(null);
      cb();
    });
    this._piece += 1;
  }

  _destroy (cb, err) {
    if (!this._torrent.destroyed) {
      this._torrent.deselect(this._startPiece, this._endPiece, true);
    }
    cb(err);
  }
};

var fileStream = FileStream$1;

const EventEmitter$2 = require$$0;
const { PassThrough } = require$$0$2;
const path$2 = require$$2$2;
const render = require$$3;
const { BlobWriteStream } = require$$4$1;
const streamToBuffer = require$$5;
const queueMicrotask$3 = require$$2$1;
const rangeParser$1 = require$$7;
const mime$1 = require$$8;
const eos = require$$9;
const FileStream = fileStream;

let File$1 = class File extends EventEmitter$2 {
  constructor (torrent, file) {
    super();

    this._torrent = torrent;
    this._destroyed = false;
    this._fileStreams = new Set();

    this.name = file.name;
    this.path = file.path;
    this.length = file.length;
    this.offset = file.offset;

    this.done = false;

    const start = file.offset;
    const end = start + file.length - 1;

    this._startPiece = start / this._torrent.pieceLength | 0;
    this._endPiece = end / this._torrent.pieceLength | 0;

    if (this.length === 0) {
      this.done = true;
      this.emit('done');
    }

    this._serviceWorker = torrent.client.serviceWorker;
  }

  get downloaded () {
    if (this._destroyed || !this._torrent.bitfield) return 0

    const { pieces, bitfield, pieceLength, lastPieceLength } = this._torrent;
    const { _startPiece: start, _endPiece: end } = this;

    const getPieceLength = (pieceIndex) => (
      pieceIndex === pieces.length - 1 ? lastPieceLength : pieceLength
    );

    const getPieceDownloaded = (pieceIndex) => {
      const len = pieceIndex === pieces.length - 1 ? lastPieceLength : pieceLength;
      if (bitfield.get(pieceIndex)) {
        // verified data
        return len
      } else {
        // "in progress" data
        return len - pieces[pieceIndex].missing
      }
    };

    let downloaded = 0;
    for (let index = start; index <= end; index += 1) {
      const pieceDownloaded = getPieceDownloaded(index);
      downloaded += pieceDownloaded;

      if (index === start) {
        // First piece may have an offset, e.g. irrelevant bytes from the end of
        // the previous file
        const irrelevantFirstPieceBytes = this.offset % pieceLength;
        downloaded -= Math.min(irrelevantFirstPieceBytes, pieceDownloaded);
      }

      if (index === end) {
        // Last piece may have an offset, e.g. irrelevant bytes from the start
        // of the next file
        const irrelevantLastPieceBytes = getPieceLength(end) - (this.offset + this.length) % pieceLength;
        downloaded -= Math.min(irrelevantLastPieceBytes, pieceDownloaded);
      }
    }

    return downloaded
  }

  get progress () {
    return this.length ? this.downloaded / this.length : 0
  }

  select (priority) {
    if (this.length === 0) return
    this._torrent.select(this._startPiece, this._endPiece, priority);
  }

  deselect () {
    if (this.length === 0) return
    this._torrent.deselect(this._startPiece, this._endPiece, false);
  }

  createReadStream (opts) {
    if (this.length === 0) {
      const empty = new PassThrough();
      queueMicrotask$3(() => {
        empty.end();
      });
      return empty
    }

    const fileStream = new FileStream(this, opts);

    this._fileStreams.add(fileStream);
    fileStream.once('close', () => {
      this._fileStreams.delete(fileStream);
    });

    return fileStream
  }

  getBuffer (cb) {
    streamToBuffer(this.createReadStream(), this.length, cb);
  }

  getBlob (cb) {
    if (typeof window === 'undefined') throw new Error('browser-only method')
    const writeStream = new BlobWriteStream(blob => {
      cb(null, blob);
    }, { mimeType: this._getMimeType() });
    this.createReadStream().pipe(writeStream);
  }

  getBlobURL (cb) {
    this.getBlob((_err, blob) => {
      cb(null, URL.createObjectURL(blob));
    });
  }

  appendTo (elem, opts, cb) {
    if (typeof window === 'undefined') throw new Error('browser-only method')
    render.append(this, elem, opts, cb);
  }

  renderTo (elem, opts, cb) {
    if (typeof window === 'undefined') throw new Error('browser-only method')
    render.render(this, elem, opts, cb);
  }

  _serve (req) {
    const res = {
      status: 200,
      headers: {
        // Support range-requests
        'Accept-Ranges': 'bytes',
        'Content-Type': mime$1.getType(this.name),
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        Expires: '0'
      },
      body: req.method === 'HEAD' ? '' : 'STREAM'
    };
    // force the browser to download the file if if it's opened in a new tab
    if (req.destination === 'document') {
      res.headers['Content-Type'] = 'application/octet-stream';
      res.headers['Content-Disposition'] = 'attachment';
      res.body = 'DOWNLOAD';
    }

    // `rangeParser` returns an array of ranges, or an error code (number) if
    // there was an error parsing the range.
    let range = rangeParser$1(this.length, req.headers.range || '');

    if (range.constructor === Array) {
      res.status = 206; // indicates that range-request was understood

      // no support for multi-range request, just use the first range
      range = range[0];

      res.headers['Content-Range'] = `bytes ${range.start}-${range.end}/${this.length}`;
      res.headers['Content-Length'] = `${range.end - range.start + 1}`;
    } else {
      res.headers['Content-Length'] = this.length;
    }

    const stream = req.method === 'GET' && this.createReadStream(range);

    let pipe = null;
    if (stream) {
      this.emit('stream', { stream, req, file: this }, piped => {
        pipe = piped;

        // piped stream might not close the original filestream on close/error, this is agressive but necessary
        eos(piped, () => {
          if (piped) piped.destroy();
          stream.destroy();
        });
      });
    }

    return [res, pipe || stream, pipe && stream]
  }

  getStreamURL (cb = () => {}) {
    if (typeof window === 'undefined') throw new Error('browser-only method')
    if (!this._serviceWorker) throw new Error('No worker registered')
    if (this._serviceWorker.state !== 'activated') throw new Error('Worker isn\'t activated')
    const workerPath = this._serviceWorker.scriptURL.slice(0, this._serviceWorker.scriptURL.lastIndexOf('/') + 1).slice(window.location.origin.length);
    const url = `${workerPath}webtorrent/${this._torrent.infoHash}/${encodeURI(this.path)}`;
    cb(null, url);
  }

  streamTo (elem, cb = () => {}) {
    if (typeof window === 'undefined') throw new Error('browser-only method')
    if (!this._serviceWorker) throw new Error('No worker registered')
    if (this._serviceWorker.state !== 'activated') throw new Error('Worker isn\'t activated')
    const workerPath = this._serviceWorker.scriptURL.slice(0, this._serviceWorker.scriptURL.lastIndexOf('/') + 1).slice(window.location.origin.length);
    elem.src = `${workerPath}webtorrent/${this._torrent.infoHash}/${encodeURI(this.path)}`;
    cb(null, elem);
  }

  _getMimeType () {
    return render.mime[path$2.extname(this.name).toLowerCase()]
  }

  _destroy () {
    this._destroyed = true;
    this._torrent = null;

    for (const fileStream of this._fileStreams) {
      fileStream.destroy();
    }
    this._fileStreams.clear();
  }
};

var file = File$1;

/**
 * Mapping of torrent pieces to their respective availability in the torrent swarm. Used
 * by the torrent manager for implementing the rarest piece first selection strategy.
 */
let RarityMap$1 = class RarityMap {
  constructor (torrent) {
    this._torrent = torrent;
    this._numPieces = torrent.pieces.length;
    this._pieces = new Array(this._numPieces);

    this._onWire = wire => {
      this.recalculate();
      this._initWire(wire);
    };
    this._onWireHave = index => {
      this._pieces[index] += 1;
    };
    this._onWireBitfield = () => {
      this.recalculate();
    };

    this._torrent.wires.forEach(wire => {
      this._initWire(wire);
    });
    this._torrent.on('wire', this._onWire);
    this.recalculate();
  }

  /**
   * Get the index of the rarest piece. Optionally, pass a filter function to exclude
   * certain pieces (for instance, those that we already have).
   *
   * @param {function} pieceFilterFunc
   * @return {number} index of rarest piece, or -1
   */
  getRarestPiece (pieceFilterFunc) {
    let candidates = [];
    let min = Infinity;

    for (let i = 0; i < this._numPieces; ++i) {
      if (pieceFilterFunc && !pieceFilterFunc(i)) continue

      const availability = this._pieces[i];
      if (availability === min) {
        candidates.push(i);
      } else if (availability < min) {
        candidates = [i];
        min = availability;
      }
    }

    if (candidates.length) {
      // if there are multiple pieces with the same availability, choose one randomly
      return candidates[Math.random() * candidates.length | 0]
    } else {
      return -1
    }
  }

  destroy () {
    this._torrent.removeListener('wire', this._onWire);
    this._torrent.wires.forEach(wire => {
      this._cleanupWireEvents(wire);
    });
    this._torrent = null;
    this._pieces = null;

    this._onWire = null;
    this._onWireHave = null;
    this._onWireBitfield = null;
  }

  _initWire (wire) {
    wire._onClose = () => {
      this._cleanupWireEvents(wire);
      for (let i = 0; i < this._numPieces; ++i) {
        this._pieces[i] -= wire.peerPieces.get(i);
      }
    };

    wire.on('have', this._onWireHave);
    wire.on('bitfield', this._onWireBitfield);
    wire.once('close', wire._onClose);
  }

  /**
   * Recalculates piece availability across all peers in the torrent.
   */
  recalculate () {
    this._pieces.fill(0);

    for (const wire of this._torrent.wires) {
      for (let i = 0; i < this._numPieces; ++i) {
        this._pieces[i] += wire.peerPieces.get(i);
      }
    }
  }

  _cleanupWireEvents (wire) {
    wire.removeListener('have', this._onWireHave);
    wire.removeListener('bitfield', this._onWireBitfield);
    if (wire._onClose) wire.removeListener('close', wire._onClose);
    wire._onClose = null;
  }
};

var rarityMap = RarityMap$1;

const http = require$$0$3;
const escapeHtml = require$$1$2;
const mime = require$$8;
const pump$1 = require$$3$1;
const rangeParser = require$$7;
const queueMicrotask$2 = require$$2$1;

function Server$1 (torrent, opts = {}) {
  const server = http.createServer();
  if (!opts.origin) opts.origin = '*'; // allow all origins by default

  const sockets = new Set();
  const pendingReady = new Set();
  let closed = false;
  const _listen = server.listen;
  const _close = server.close;

  server.listen = (...args) => {
    closed = false;
    server.on('connection', onConnection);
    server.on('request', onRequest);
    return _listen.apply(server, args)
  };

  server.close = cb => {
    closed = true;
    server.removeListener('connection', onConnection);
    server.removeListener('request', onRequest);
    pendingReady.forEach(onReady => {
      torrent.removeListener('ready', onReady);
    });
    pendingReady.clear();
    _close.call(server, cb);
  };

  server.destroy = cb => {
    sockets.forEach(socket => {
      socket.destroy();
    });

    // Only call `server.close` if user has not called it already
    if (!cb) cb = () => {};
    if (closed) queueMicrotask$2(cb);
    else server.close(cb);
    torrent = null;
  };

  function isOriginAllowed (req) {
    // When `origin` option is `false`, deny all cross-origin requests
    if (opts.origin === false) return false

    // Requests without an 'Origin' header are not actually cross-origin, so just
    // deny them
    if (req.headers.origin == null) return false

    // The user allowed all origins
    if (opts.origin === '*') return true

    // Allow requests where the 'Origin' header matches the `opts.origin` setting
    return req.headers.origin === opts.origin
  }

  function onConnection (socket) {
    socket.setTimeout(36000000);
    sockets.add(socket);
    socket.once('close', () => {
      sockets.delete(socket);
    });
  }

  function onRequest (req, res) {
    // If a 'hostname' string is specified, deny requests with a 'Host'
    // header that does not match the origin of the torrent server to prevent
    // DNS rebinding attacks.
    if (opts.hostname && req.headers.host !== `${opts.hostname}:${server.address().port}`) {
      return req.destroy()
    }

    const pathname = new URL(req.url, 'http://example.com').pathname;

    // Allow cross-origin requests (CORS)
    if (isOriginAllowed(req)) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    }

    // Prevent browser mime-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Defense-in-depth: Set a strict Content Security Policy to mitigate XSS
    res.setHeader('Content-Security-Policy', "base-uri 'none'; default-src 'none'; frame-ancestors 'none'; form-action 'none';");

    if (pathname === '/favicon.ico') {
      return serve404Page()
    }

    // Allow CORS requests to specify arbitrary headers, e.g. 'Range',
    // by responding to the OPTIONS preflight request with the specified
    // origin and requested headers.
    if (req.method === 'OPTIONS') {
      if (isOriginAllowed(req)) return serveOptionsRequest()
      else return serveMethodNotAllowed()
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (torrent.ready) {
        return handleRequest()
      } else {
        pendingReady.add(onReady);
        torrent.once('ready', onReady);
        return
      }
    }

    return serveMethodNotAllowed()

    function serveOptionsRequest () {
      res.statusCode = 204; // no content
      res.setHeader('Access-Control-Max-Age', '600');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD');

      if (req.headers['access-control-request-headers']) {
        res.setHeader(
          'Access-Control-Allow-Headers',
          req.headers['access-control-request-headers']
        );
      }
      res.end();
    }

    function onReady () {
      pendingReady.delete(onReady);
      handleRequest();
    }

    function handleRequest () {
      if (pathname === '/') {
        return serveIndexPage()
      }

      const index = Number(pathname.split('/')[1]);
      if (Number.isNaN(index) || index >= torrent.files.length) {
        return serve404Page()
      }

      const file = torrent.files[index];
      serveFile(file);
    }

    function serveIndexPage () {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');

      const listHtml = torrent.files
        .map((file, i) => (
          `<li>
            <a
              download="${escapeHtml(file.name)}"
              href="${escapeHtml(i)}/${escapeHtml(file.name)}"
            >
              ${escapeHtml(file.path)}
            </a>
            (${escapeHtml(file.length)} bytes)
          </li>`
        ))
        .join('<br>');

      const html = getPageHTML(
        `${escapeHtml(torrent.name)} - WebTorrent`,
        `
          <h1>${escapeHtml(torrent.name)}</h1>
          <ol>${listHtml}</ol>
        `
      );
      res.end(html);
    }

    function serve404Page () {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html');

      const html = getPageHTML(
        '404 - Not Found',
        '<h1>404 - Not Found</h1>'
      );
      res.end(html);
    }

    function serveFile (file) {
      res.setHeader('Content-Type', mime.getType(file.name) || 'application/octet-stream');

      // Support range-requests
      res.setHeader('Accept-Ranges', 'bytes');

      // Set name of file (for "Save Page As..." dialog)
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeRFC5987(file.name)}`
      );

      // Support DLNA streaming
      res.setHeader('transferMode.dlna.org', 'Streaming');
      res.setHeader(
        'contentFeatures.dlna.org',
        'DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000'
      );

      // `rangeParser` returns an array of ranges, or an error code (number) if
      // there was an error parsing the range.
      let range = rangeParser(file.length, req.headers.range || '');

      if (Array.isArray(range)) {
        res.statusCode = 206; // indicates that range-request was understood

        // no support for multi-range request, just use the first range
        range = range[0];

        res.setHeader(
          'Content-Range',
          `bytes ${range.start}-${range.end}/${file.length}`
        );
        res.setHeader('Content-Length', range.end - range.start + 1);
      } else {
        res.statusCode = 200;
        range = null;
        res.setHeader('Content-Length', file.length);
      }

      if (req.method === 'HEAD') {
        return res.end()
      }

      pump$1(file.createReadStream(range), res);
    }

    function serveMethodNotAllowed () {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'text/html');
      const html = getPageHTML(
        '405 - Method Not Allowed',
        '<h1>405 - Method Not Allowed</h1>'
      );
      res.end(html);
    }
  }

  return server
}

// NOTE: Arguments must already be HTML-escaped
function getPageHTML (title, pageHtml) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
      </head>
      <body>
        ${pageHtml}
      </body>
    </html>
  `
}

// From https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
function encodeRFC5987 (str) {
  return encodeURIComponent(str)
    // Note that although RFC3986 reserves "!", RFC5987 does not,
    // so we do not need to escape it
    .replace(/['()]/g, escape) // i.e., %27 %28 %29
    .replace(/\*/g, '%2A')
    // The following are not required for percent-encoding per RFC5987,
    // so we can allow for a little better readability over the wire: |`^
    .replace(/%(?:7C|60|5E)/g, unescape)
}

var server = Server$1;

var name = "webtorrent";
var description = "Streaming torrent client";
var version = "1.9.7";
var author = {
	name: "WebTorrent LLC",
	email: "feross@webtorrent.io",
	url: "https://webtorrent.io"
};
var browser = {
	"./lib/server.js": false,
	"./lib/conn-pool.js": false,
	"./lib/utp.js": false,
	"bittorrent-dht/client": false,
	fs: false,
	"fs-chunk-store": "memory-chunk-store",
	"load-ip-set": false,
	net: false,
	os: false,
	ut_pex: false
};
var browserify = {
	transform: [
		"package-json-versionify"
	]
};
var bugs = {
	url: "https://github.com/webtorrent/webtorrent/issues"
};
var chromeapp = {
	"./lib/utp.js": false,
	"fs-chunk-store": "memory-chunk-store",
	http: "@webtorrent/http-node",
	"load-ip-set": false,
	net: "chrome-net",
	os: false
};
var dependencies = {
	"@webtorrent/http-node": "^1.3.0",
	"addr-to-ip-port": "^1.5.4",
	bitfield: "^4.1.0",
	"bittorrent-dht": "^10.0.7",
	"bittorrent-protocol": "^3.5.5",
	"cache-chunk-store": "^3.2.2",
	"chrome-net": "^3.3.4",
	"chunk-store-stream": "^4.3.0",
	cpus: "^1.0.3",
	"create-torrent": "^5.0.9",
	debug: "^4.3.4",
	"end-of-stream": "^1.4.4",
	"escape-html": "^1.0.3",
	"fast-blob-stream": "^1.1.1",
	"fs-chunk-store": "^3.0.1",
	"immediate-chunk-store": "^2.2.0",
	"join-async-iterator": "^1.1.1",
	"load-ip-set": "^2.2.1",
	lt_donthave: "^1.0.1",
	"memory-chunk-store": "^1.3.5",
	mime: "^3.0.0",
	"package-json-versionify": "^1.0.4",
	"parse-torrent": "^9.1.5",
	pump: "^3.0.0",
	"queue-microtask": "^1.2.3",
	"random-iterate": "^1.0.1",
	randombytes: "^2.1.0",
	"range-parser": "^1.2.1",
	"render-media": "^4.1.0",
	"run-parallel": "^1.2.0",
	"run-parallel-limit": "^1.1.0",
	"simple-concat": "^1.0.1",
	"simple-get": "^4.0.1",
	"simple-peer": "^9.11.1",
	"simple-sha1": "^3.1.0",
	"speed-limiter": "^1.0.2",
	"stream-with-known-length-to-buffer": "^1.0.4",
	streamx: "^2.12.5",
	throughput: "^1.0.1",
	"torrent-discovery": "^9.4.15",
	"torrent-piece": "^2.0.1",
	"unordered-array-remove": "^1.0.2",
	ut_metadata: "^3.5.2",
	ut_pex: "^3.0.2"
};
var devDependencies = {
	"@webtorrent/semantic-release-config": "1.0.8",
	airtap: "4.0.4",
	"airtap-manual": "1.0.0",
	"airtap-sauce": "1.1.2",
	"babel-minify": "0.5.2",
	"bittorrent-tracker": "9.19.0",
	browserify: "17.0.0",
	disc: "1.3.3",
	finalhandler: "1.2.0",
	"network-address": "1.1.2",
	"run-series": "1.1.9",
	"semantic-release": "19.0.5",
	"serve-static": "1.15.0",
	standard: "*",
	tape: "5.6.1",
	"webtorrent-fixtures": "1.7.5"
};
var optionalDependencies = {
	"utp-native": "^2.5.3"
};
var engines = {
	node: ">=14"
};
var funding = [
	{
		type: "github",
		url: "https://github.com/sponsors/feross"
	},
	{
		type: "patreon",
		url: "https://www.patreon.com/feross"
	},
	{
		type: "consulting",
		url: "https://feross.org/support"
	}
];
var homepage = "https://webtorrent.io";
var keywords = [
	"bittorrent",
	"bittorrent client",
	"download",
	"mad science",
	"p2p",
	"peer-to-peer",
	"peers",
	"streaming",
	"swarm",
	"torrent",
	"web torrent",
	"webrtc",
	"webrtc data",
	"webtorrent"
];
var license = "MIT";
var main = "index.js";
var repository = {
	type: "git",
	url: "git://github.com/webtorrent/webtorrent.git"
};
var scripts = {
	build: "npm run build-js && npm run build-js-worker && npm run build-chromeapp",
	"build-chromeapp": "browserify --browser-field=chromeapp --standalone WebTorrent . | minify --mangle=false > webtorrent.chromeapp.js",
	"build-chromeapp-debug": "browserify --browser-field=chromeapp --standalone WebTorrent . > webtorrent.chromeapp.js",
	"build-js": "browserify --standalone WebTorrent . | minify --mangle=false > webtorrent.min.js",
	"build-js-worker": "browserify ./lib/worker.js | minify --mangle=false > sw.min.js",
	"build-js-debug": "browserify --standalone WebTorrent . > webtorrent.debug.js",
	"build-js-worker-debug": "browserify ./lib/worker.js > sw.debug.js",
	prepublishOnly: "npm run build && npm run update-authors",
	preversion: "npm run build && npm run update-authors",
	size: "npm run size-js && npm run size-disc",
	"size-disc": "browserify --full-paths . | discify --open",
	"size-js": "npm run build && cat webtorrent.min.js | gzip | wc -c",
	test: "standard && npm run test-node && npm run test-browser",
	"test-browser": "airtap --concurrency 1 -- test/*.js test/browser/*.js",
	"test-browser-local": "airtap --preset local -- test/*.js test/browser/*.js",
	"test-node": "tape test/*.js test/node/*.js",
	"update-authors": "./scripts/update-authors.sh"
};
var standard = {
	ignore: [
		"webtorrent.min.js",
		"sw.min.js",
		"webtorrent.chromeapp.js"
	]
};
var renovate = {
	"extends": [
		"github>webtorrent/renovate-config"
	],
	rangeStrategy: "bump"
};
var release = {
	"extends": "@webtorrent/semantic-release-config"
};
var require$$36 = {
	name: name,
	description: description,
	version: version,
	author: author,
	browser: browser,
	browserify: browserify,
	bugs: bugs,
	chromeapp: chromeapp,
	dependencies: dependencies,
	devDependencies: devDependencies,
	optionalDependencies: optionalDependencies,
	engines: engines,
	funding: funding,
	homepage: homepage,
	keywords: keywords,
	license: license,
	main: main,
	repository: repository,
	scripts: scripts,
	standard: standard,
	renovate: renovate,
	release: release
};

const BitField$1 = require$$0$4;
const debugFactory$2 = require$$1$1;
const get$1 = require$$2$3;
const ltDontHave$1 = require$$3$2;
const sha1$2 = require$$4$2;
const Wire = require$$4;

const debug$2 = debugFactory$2('webtorrent:webconn');
const VERSION$2 = require$$36.version;

const SOCKET_TIMEOUT = 60000;
const RETRY_DELAY = 10000;

/**
 * Converts requests for torrent blocks into http range requests.
 * @param {string} url web seed url
 * @param {Object} torrent
 */
let WebConn$1 = class WebConn extends Wire {
  constructor (url, torrent) {
    super();

    this.url = url;
    this.connId = url; // Unique id to deduplicate web seeds
    this.webPeerId = sha1$2.sync(url); // Used as the peerId for this fake remote peer
    this._torrent = torrent;

    this._init();
  }

  _init () {
    this.setKeepAlive(true);

    this.use(ltDontHave$1());

    this.once('handshake', (infoHash, peerId) => {
      if (this.destroyed) return
      this.handshake(infoHash, this.webPeerId);
      const numPieces = this._torrent.pieces.length;
      const bitfield = new BitField$1(numPieces);
      for (let i = 0; i <= numPieces; i++) {
        bitfield.set(i, true);
      }
      this.bitfield(bitfield);
    });

    this.once('interested', () => {
      debug$2('interested');
      this.unchoke();
    });

    this.on('uninterested', () => { debug$2('uninterested'); });
    this.on('choke', () => { debug$2('choke'); });
    this.on('unchoke', () => { debug$2('unchoke'); });
    this.on('bitfield', () => { debug$2('bitfield'); });
    this.lt_donthave.on('donthave', () => { debug$2('donthave'); });

    this.on('request', (pieceIndex, offset, length, callback) => {
      debug$2('request pieceIndex=%d offset=%d length=%d', pieceIndex, offset, length);
      this.httpRequest(pieceIndex, offset, length, (err, data) => {
        if (err) {
          // Cancel all in progress requests for this piece
          this.lt_donthave.donthave(pieceIndex);

          // Wait a little while before saying the webseed has the failed piece again
          const retryTimeout = setTimeout(() => {
            if (this.destroyed) return

            this.have(pieceIndex);
          }, RETRY_DELAY);
          if (retryTimeout.unref) retryTimeout.unref();
        }

        callback(err, data);
      });
    });
  }

  httpRequest (pieceIndex, offset, length, cb) {
    const pieceOffset = pieceIndex * this._torrent.pieceLength;
    const rangeStart = pieceOffset + offset; /* offset within whole torrent */
    const rangeEnd = rangeStart + length - 1;

    // Web seed URL format:
    // For single-file torrents, make HTTP range requests directly to the web seed URL
    // For multi-file torrents, add the torrent folder and file name to the URL
    const files = this._torrent.files;
    let requests;
    if (files.length <= 1) {
      requests = [{
        url: this.url,
        start: rangeStart,
        end: rangeEnd
      }];
    } else {
      const requestedFiles = files.filter(file => file.offset <= rangeEnd && (file.offset + file.length) > rangeStart);
      if (requestedFiles.length < 1) {
        return cb(new Error('Could not find file corresponding to web seed range request'))
      }

      requests = requestedFiles.map(requestedFile => {
        const fileEnd = requestedFile.offset + requestedFile.length - 1;
        const url = this.url +
          (this.url[this.url.length - 1] === '/' ? '' : '/') +
          requestedFile.path.replace(this._torrent.path, '');
        return {
          url,
          fileOffsetInRange: Math.max(requestedFile.offset - rangeStart, 0),
          start: Math.max(rangeStart - requestedFile.offset, 0),
          end: Math.min(fileEnd, rangeEnd - requestedFile.offset)
        }
      });
    }

    // Now make all the HTTP requests we need in order to load this piece
    // Usually that's one requests, but sometimes it will be multiple
    // Send requests in parallel and wait for them all to come back
    let numRequestsSucceeded = 0;
    let hasError = false;

    let ret;
    if (requests.length > 1) {
      ret = Buffer.alloc(length);
    }

    requests.forEach(request => {
      const url = request.url;
      const start = request.start;
      const end = request.end;
      debug$2(
        'Requesting url=%s pieceIndex=%d offset=%d length=%d start=%d end=%d',
        url, pieceIndex, offset, length, start, end
      );
      const opts = {
        url,
        method: 'GET',
        headers: {
          'user-agent': `WebTorrent/${VERSION$2} (https://webtorrent.io)`,
          range: `bytes=${start}-${end}`
        },
        timeout: SOCKET_TIMEOUT
      };
      function onResponse (res, data) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          if (hasError) return
          hasError = true;
          return cb(new Error(`Unexpected HTTP status code ${res.statusCode}`))
        }
        debug$2('Got data of length %d', data.length);

        if (requests.length === 1) {
          // Common case: fetch piece in a single HTTP request, return directly
          cb(null, data);
        } else {
          // Rare case: reconstruct multiple HTTP requests across 2+ files into one
          // piece buffer
          data.copy(ret, request.fileOffsetInRange);
          if (++numRequestsSucceeded === requests.length) {
            cb(null, ret);
          }
        }
      }
      get$1.concat(opts, (err, res, data) => {
        if (hasError) return
        if (err) {
          // Browsers allow HTTP redirects for simple cross-origin
          // requests but not for requests that require preflight.
          // Use a simple request to unravel any redirects and get the
          // final URL.  Retry the original request with the new URL if
          // it's different.
          //
          // This test is imperfect but it's simple and good for common
          // cases.  It catches all cross-origin cases but matches a few
          // same-origin cases too.
          if (typeof window === 'undefined' || url.startsWith(`${window.location.origin}/`)) {
            hasError = true;
            return cb(err)
          }

          return get$1.head(url, (errHead, res) => {
            if (hasError) return
            if (errHead) {
              hasError = true;
              return cb(errHead)
            }
            if (res.statusCode < 200 || res.statusCode >= 300) {
              hasError = true;
              return cb(new Error(`Unexpected HTTP status code ${res.statusCode}`))
            }
            if (res.url === url) {
              hasError = true;
              return cb(err)
            }

            opts.url = res.url;
            get$1.concat(opts, (err, res, data) => {
              if (hasError) return
              if (err) {
                hasError = true;
                return cb(err)
              }
              onResponse(res, data);
            });
          })
        }
        onResponse(res, data);
      });
    });
  }

  destroy () {
    super.destroy();
    this._torrent = null;
  }
};

var webconn = WebConn$1;

/* global Blob */

const EventEmitter$1 = require$$0;
const fs = require$$1$3;
const net = require$$0$1; // browser exclude
const os = require$$3$3; // browser exclude
const path$1 = require$$2$2;
const addrToIPPort = require$$5$1;
const BitField = require$$0$4;
const CacheChunkStore = require$$7$1;
const ChunkStoreWriteStream = require$$8$1;
const cpus = require$$9$1;
const debugFactory$1 = require$$1$1;
const Discovery = require$$11;
const FSChunkStore = require$$12; // browser: `memory-chunk-store`
const get = require$$2$3;
const ImmediateChunkStore = require$$14;
const ltDontHave = require$$3$2;
const MemoryChunkStore = require$$16;
const joinIterator = require$$17;
const parallel$1 = require$$18;
const parallelLimit = require$$19;
const parseTorrent$1 = require$$20;
const Piece = require$$21;
const pump = require$$3$1;
const queueMicrotask$1 = require$$2$1;
const randomIterate = require$$24;
const sha1$1 = require$$4$2;
const throughput$1 = require$$26;
const utMetadata = require$$27;
const utPex = require$$28; // browser exclude
const { Readable } = require$$0$2;

const File = file;
const Peer$1 = requirePeer();
const RarityMap = rarityMap;
const Server = server; // browser exclude
const utp = utp$2; // browser exclude
const WebConn = webconn;

const debug$1 = debugFactory$1('webtorrent:torrent');
const MAX_BLOCK_LENGTH = 128 * 1024;
const PIECE_TIMEOUT = 30000;
const CHOKE_TIMEOUT = 5000;
const SPEED_THRESHOLD = 3 * Piece.BLOCK_LENGTH;

const PIPELINE_MIN_DURATION = 0.5;
const PIPELINE_MAX_DURATION = 1;

const RECHOKE_INTERVAL = 10000; // 10 seconds
const RECHOKE_OPTIMISTIC_DURATION = 2; // 30 seconds

// IndexedDB chunk stores used in the browser benefit from high concurrency
const FILESYSTEM_CONCURRENCY = process.browser ? cpus().length : 2;

const RECONNECT_WAIT = [1000, 5000, 15000];

const VERSION$1 = require$$36.version;
const USER_AGENT = `WebTorrent/${VERSION$1} (https://webtorrent.io)`;

let TMP;
try {
  TMP = path$1.join(fs.statSync('/tmp') && '/tmp', 'webtorrent');
} catch (err) {
  TMP = path$1.join(typeof os.tmpdir === 'function' ? os.tmpdir() : '/', 'webtorrent');
}

let Torrent$1 = class Torrent extends EventEmitter$1 {
  constructor (torrentId, client, opts) {
    super();

    this._debugId = 'unknown infohash';
    this.client = client;

    this.announce = opts.announce;
    this.urlList = opts.urlList;

    this.path = opts.path || TMP;
    this.addUID = opts.addUID || false;
    this.skipVerify = !!opts.skipVerify;
    this._store = opts.store || FSChunkStore;
    this._preloadedStore = opts.preloadedStore || null;
    this._storeCacheSlots = opts.storeCacheSlots !== undefined ? opts.storeCacheSlots : 20;
    this._destroyStoreOnDestroy = opts.destroyStoreOnDestroy || false;
    this._getAnnounceOpts = opts.getAnnounceOpts;

    // if defined, `opts.private` overrides default privacy of torrent
    if (typeof opts.private === 'boolean') this.private = opts.private;

    this.strategy = opts.strategy || 'sequential';

    this.maxWebConns = opts.maxWebConns || 4;

    this._rechokeNumSlots = (opts.uploads === false || opts.uploads === 0)
      ? 0
      : (+opts.uploads || 10);
    this._rechokeOptimisticWire = null;
    this._rechokeOptimisticTime = 0;
    this._rechokeIntervalId = null;

    this.ready = false;
    this.destroyed = false;
    this.paused = opts.paused || false;
    this.done = false;

    this.metadata = null;
    this.store = null;
    this.storeOpts = opts.storeOpts;
    this.files = [];
    this.pieces = [];

    this._amInterested = false;
    this._selections = [];
    this._critical = [];

    this.wires = []; // open wires (added *after* handshake)

    this._queue = []; // queue of outgoing tcp peers to connect to
    this._peers = {}; // connected peers (addr/peerId -> Peer)
    this._peersLength = 0; // number of elements in `this._peers` (cache, for perf)

    // stats
    this.received = 0;
    this.uploaded = 0;
    this._downloadSpeed = throughput$1();
    this._uploadSpeed = throughput$1();

    // for cleanup
    this._servers = [];
    this._xsRequests = [];

    // TODO: remove this and expose a hook instead
    // optimization: don't recheck every file if it hasn't changed
    this._fileModtimes = opts.fileModtimes;

    if (torrentId !== null) this._onTorrentId(torrentId);

    this._debug('new torrent');
  }

  get timeRemaining () {
    if (this.done) return 0
    if (this.downloadSpeed === 0) return Infinity
    return ((this.length - this.downloaded) / this.downloadSpeed) * 1000
  }

  get downloaded () {
    if (!this.bitfield) return 0
    let downloaded = 0;
    for (let index = 0, len = this.pieces.length; index < len; ++index) {
      if (this.bitfield.get(index)) { // verified data
        downloaded += (index === len - 1) ? this.lastPieceLength : this.pieceLength;
      } else { // "in progress" data
        const piece = this.pieces[index];
        downloaded += (piece.length - piece.missing);
      }
    }
    return downloaded
  }

  // TODO: re-enable this. The number of missing pieces. Used to implement 'end game' mode.
  // Object.defineProperty(Storage.prototype, 'numMissing', {
  //   get: function () {
  //     var self = this
  //     var numMissing = self.pieces.length
  //     for (var index = 0, len = self.pieces.length; index < len; index++) {
  //       numMissing -= self.bitfield.get(index)
  //     }
  //     return numMissing
  //   }
  // })

  get downloadSpeed () { return this._downloadSpeed() }

  get uploadSpeed () { return this._uploadSpeed() }

  get progress () { return this.length ? this.downloaded / this.length : 0 }

  get ratio () { return this.uploaded / (this.received || this.length) }

  get numPeers () { return this.wires.length }

  get torrentFileBlobURL () {
    if (typeof window === 'undefined') throw new Error('browser-only property')
    if (!this.torrentFile) return null
    return URL.createObjectURL(
      new Blob([this.torrentFile], { type: 'application/x-bittorrent' })
    )
  }

  get _numQueued () {
    return this._queue.length + (this._peersLength - this._numConns)
  }

  get _numConns () {
    let numConns = 0;
    for (const id in this._peers) {
      if (this._peers[id].connected) numConns += 1;
    }
    return numConns
  }

  _onTorrentId (torrentId) {
    if (this.destroyed) return

    let parsedTorrent;
    try { parsedTorrent = parseTorrent$1(torrentId); } catch (err) {}
    if (parsedTorrent) {
      // Attempt to set infoHash property synchronously
      this.infoHash = parsedTorrent.infoHash;
      this._debugId = parsedTorrent.infoHash.toString('hex').substring(0, 7);
      queueMicrotask$1(() => {
        if (this.destroyed) return
        this._onParsedTorrent(parsedTorrent);
      });
    } else {
      // If torrentId failed to parse, it could be in a form that requires an async
      // operation, i.e. http/https link, filesystem path, or Blob.
      parseTorrent$1.remote(torrentId, (err, parsedTorrent) => {
        if (this.destroyed) return
        if (err) return this._destroy(err)
        this._onParsedTorrent(parsedTorrent);
      });
    }
  }

  _onParsedTorrent (parsedTorrent) {
    if (this.destroyed) return

    this._processParsedTorrent(parsedTorrent);

    if (!this.infoHash) {
      return this._destroy(new Error('Malformed torrent data: No info hash'))
    }

    this._rechokeIntervalId = setInterval(() => {
      this._rechoke();
    }, RECHOKE_INTERVAL);
    if (this._rechokeIntervalId.unref) this._rechokeIntervalId.unref();

    // Private 'infoHash' event allows client.add to check for duplicate torrents and
    // destroy them before the normal 'infoHash' event is emitted. Prevents user
    // applications from needing to deal with duplicate 'infoHash' events.
    this.emit('_infoHash', this.infoHash);
    if (this.destroyed) return

    this.emit('infoHash', this.infoHash);
    if (this.destroyed) return // user might destroy torrent in event handler

    if (this.client.listening) {
      this._onListening();
    } else {
      this.client.once('listening', () => {
        this._onListening();
      });
    }
  }

  _processParsedTorrent (parsedTorrent) {
    this._debugId = parsedTorrent.infoHash.toString('hex').substring(0, 7);

    if (typeof this.private !== 'undefined') {
      // `private` option overrides default, only if it's defined
      parsedTorrent.private = this.private;
    }

    if (this.announce) {
      // Allow specifying trackers via `opts` parameter
      parsedTorrent.announce = parsedTorrent.announce.concat(this.announce);
    }

    if (this.client.tracker && commonjsGlobal.WEBTORRENT_ANNOUNCE && !parsedTorrent.private) {
      // So `webtorrent-hybrid` can force specific trackers to be used
      parsedTorrent.announce = parsedTorrent.announce.concat(commonjsGlobal.WEBTORRENT_ANNOUNCE);
    }

    if (this.urlList) {
      // Allow specifying web seeds via `opts` parameter
      parsedTorrent.urlList = parsedTorrent.urlList.concat(this.urlList);
    }

    // remove duplicates by converting to Set and back
    parsedTorrent.announce = Array.from(new Set(parsedTorrent.announce));
    parsedTorrent.urlList = Array.from(new Set(parsedTorrent.urlList));

    Object.assign(this, parsedTorrent);

    this.magnetURI = parseTorrent$1.toMagnetURI(parsedTorrent);
    this.torrentFile = parseTorrent$1.toTorrentFile(parsedTorrent);
  }

  _onListening () {
    if (this.destroyed) return

    if (this.info) {
      // if full metadata was included in initial torrent id, use it immediately. Otherwise,
      // wait for torrent-discovery to find peers and ut_metadata to get the metadata.
      this._onMetadata(this);
    } else {
      if (this.xs) this._getMetadataFromServer();
      this._startDiscovery();
    }
  }

  _startDiscovery () {
    if (this.discovery || this.destroyed) return

    let trackerOpts = this.client.tracker;
    if (trackerOpts) {
      trackerOpts = Object.assign({}, this.client.tracker, {
        getAnnounceOpts: () => {
          if (this.destroyed) return

          const opts = {
            uploaded: this.uploaded,
            downloaded: this.downloaded,
            left: Math.max(this.length - this.downloaded, 0)
          };
          if (this.client.tracker.getAnnounceOpts) {
            Object.assign(opts, this.client.tracker.getAnnounceOpts());
          }
          if (this._getAnnounceOpts) {
            // TODO: consider deprecating this, as it's redundant with the former case
            Object.assign(opts, this._getAnnounceOpts());
          }
          return opts
        }
      });
    }

    // add BEP09 peer-address
    if (this.peerAddresses) {
      this.peerAddresses.forEach(peer => this.addPeer(peer));
    }

    // begin discovering peers via DHT and trackers
    this.discovery = new Discovery({
      infoHash: this.infoHash,
      announce: this.announce,
      peerId: this.client.peerId,
      dht: !this.private && this.client.dht,
      tracker: trackerOpts,
      port: this.client.torrentPort,
      userAgent: USER_AGENT,
      lsd: this.client.lsd
    });

    this.discovery.on('error', (err) => {
      this._destroy(err);
    });

    this.discovery.on('peer', (peer, source) => {
      this._debug('peer %s discovered via %s', peer, source);
      // Don't create new outgoing TCP connections when torrent is done
      if (typeof peer === 'string' && this.done) return
      this.addPeer(peer);
    });

    this.discovery.on('trackerAnnounce', () => {
      this.emit('trackerAnnounce');
      if (this.numPeers === 0) this.emit('noPeers', 'tracker');
    });

    this.discovery.on('dhtAnnounce', () => {
      this.emit('dhtAnnounce');
      if (this.numPeers === 0) this.emit('noPeers', 'dht');
    });

    this.discovery.on('warning', (err) => {
      this.emit('warning', err);
    });
  }

  _getMetadataFromServer () {
    // to allow function hoisting
    const self = this;

    const urls = Array.isArray(this.xs) ? this.xs : [this.xs];

    const tasks = urls.map(url => cb => {
      getMetadataFromURL(url, cb);
    });
    parallel$1(tasks);

    function getMetadataFromURL (url, cb) {
      if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
        self.emit('warning', new Error(`skipping non-http xs param: ${url}`));
        return cb(null)
      }

      const opts = {
        url,
        method: 'GET',
        headers: {
          'user-agent': USER_AGENT
        }
      };
      let req;
      try {
        req = get.concat(opts, onResponse);
      } catch (err) {
        self.emit('warning', new Error(`skipping invalid url xs param: ${url}`));
        return cb(null)
      }

      self._xsRequests.push(req);

      function onResponse (err, res, torrent) {
        if (self.destroyed) return cb(null)
        if (self.metadata) return cb(null)

        if (err) {
          self.emit('warning', new Error(`http error from xs param: ${url}`));
          return cb(null)
        }
        if (res.statusCode !== 200) {
          self.emit('warning', new Error(`non-200 status code ${res.statusCode} from xs param: ${url}`));
          return cb(null)
        }

        let parsedTorrent;
        try {
          parsedTorrent = parseTorrent$1(torrent);
        } catch (err) {}

        if (!parsedTorrent) {
          self.emit('warning', new Error(`got invalid torrent file from xs param: ${url}`));
          return cb(null)
        }

        if (parsedTorrent.infoHash !== self.infoHash) {
          self.emit('warning', new Error(`got torrent file with incorrect info hash from xs param: ${url}`));
          return cb(null)
        }

        self._onMetadata(parsedTorrent);
        cb(null);
      }
    }
  }

  /**
   * Called when the full torrent metadata is received.
   */
  _onMetadata (metadata) {
    if (this.metadata || this.destroyed) return
    this._debug('got metadata');

    this._xsRequests.forEach(req => {
      req.abort();
    });
    this._xsRequests = [];

    let parsedTorrent;
    if (metadata && metadata.infoHash) {
      // `metadata` is a parsed torrent (from parse-torrent module)
      parsedTorrent = metadata;
    } else {
      try {
        parsedTorrent = parseTorrent$1(metadata);
      } catch (err) {
        return this._destroy(err)
      }
    }

    this._processParsedTorrent(parsedTorrent);
    this.metadata = this.torrentFile;

    // add web seed urls (BEP19)
    if (this.client.enableWebSeeds) {
      this.urlList.forEach(url => {
        this.addWebSeed(url);
      });
    }

    this._rarityMap = new RarityMap(this);

    this.files = this.files.map(file => new File(this, file));

    let rawStore = this._preloadedStore;
    if (!rawStore) {
      rawStore = new this._store(this.pieceLength, {
        ...this.storeOpts,
        torrent: this,
        path: this.path,
        files: this.files,
        length: this.length,
        name: this.name + ' - ' + this.infoHash.slice(0, 8),
        addUID: this.addUID
      });
    }

    // don't use the cache if the store is already in memory
    if (this._storeCacheSlots > 0 && !(rawStore instanceof MemoryChunkStore)) {
      rawStore = new CacheChunkStore(rawStore, {
        max: this._storeCacheSlots
      });
    }

    this.store = new ImmediateChunkStore(
      rawStore
    );

    // Select only specified files (BEP53) http://www.bittorrent.org/beps/bep_0053.html
    if (this.so) {
      this.files.forEach((v, i) => {
        if (this.so.includes(i)) {
          this.files[i].select();
        } else {
          this.files[i].deselect();
        }
      });
    } else {
      // start off selecting the entire torrent with low priority
      if (this.pieces.length !== 0) {
        this.select(0, this.pieces.length - 1, false);
      }
    }

    this._hashes = this.pieces;

    this.pieces = this.pieces.map((hash, i) => {
      const pieceLength = (i === this.pieces.length - 1)
        ? this.lastPieceLength
        : this.pieceLength;
      return new Piece(pieceLength)
    });

    this._reservations = this.pieces.map(() => []);

    this.bitfield = new BitField(this.pieces.length);

    // Emit 'metadata' before 'ready' and 'done'
    this.emit('metadata');

    // User might destroy torrent in response to 'metadata' event
    if (this.destroyed) return

    if (this.skipVerify) {
      // Skip verifying exisitng data and just assume it's correct
      this._markAllVerified();
      this._onStore();
    } else {
      const onPiecesVerified = (err) => {
        if (err) return this._destroy(err)
        this._debug('done verifying');
        this._onStore();
      };

      this._debug('verifying existing torrent data');
      if (this._fileModtimes && this._store === FSChunkStore) {
        // don't verify if the files haven't been modified since we last checked
        this.getFileModtimes((err, fileModtimes) => {
          if (err) return this._destroy(err)

          const unchanged = this.files.map((_, index) => fileModtimes[index] === this._fileModtimes[index]).every(x => x);

          if (unchanged) {
            this._markAllVerified();
            this._onStore();
          } else {
            this._verifyPieces(onPiecesVerified);
          }
        });
      } else {
        this._verifyPieces(onPiecesVerified);
      }
    }
  }

  /*
   * TODO: remove this
   * Gets the last modified time of every file on disk for this torrent.
   * Only valid in Node, not in the browser.
   */
  getFileModtimes (cb) {
    const ret = [];
    parallelLimit(this.files.map((file, index) => cb => {
      const filePath = this.addUID ? path$1.join(this.name + ' - ' + this.infoHash.slice(0, 8)) : path$1.join(this.path, file.path);
      fs.stat(filePath, (err, stat) => {
        if (err && err.code !== 'ENOENT') return cb(err)
        ret[index] = stat && stat.mtime.getTime();
        cb(null);
      });
    }), FILESYSTEM_CONCURRENCY, err => {
      this._debug('done getting file modtimes');
      cb(err, ret);
    });
  }

  _verifyPieces (cb) {
    parallelLimit(this.pieces.map((piece, index) => cb => {
      if (this.destroyed) return cb(new Error('torrent is destroyed'))

      const getOpts = {};
      // Specify length for the last piece in case it is zero-padded
      if (index === this.pieces.length - 1) {
        getOpts.length = this.lastPieceLength;
      }
      this.store.get(index, getOpts, (err, buf) => {
        if (this.destroyed) return cb(new Error('torrent is destroyed'))

        if (err) return queueMicrotask$1(() => cb(null)) // ignore error
        sha1$1(buf, hash => {
          if (this.destroyed) return cb(new Error('torrent is destroyed'))

          if (hash === this._hashes[index]) {
            this._debug('piece verified %s', index);
            this._markVerified(index);
          } else {
            this._debug('piece invalid %s', index);
          }
          cb(null);
        });
      });
    }), FILESYSTEM_CONCURRENCY, cb);
  }

  rescanFiles (cb) {
    if (this.destroyed) throw new Error('torrent is destroyed')
    if (!cb) cb = noop;

    this._verifyPieces((err) => {
      if (err) {
        this._destroy(err);
        return cb(err)
      }

      this._checkDone();
      cb(null);
    });
  }

  _markAllVerified () {
    for (let index = 0; index < this.pieces.length; index++) {
      this._markVerified(index);
    }
  }

  _markVerified (index) {
    this.pieces[index] = null;
    this._reservations[index] = null;
    this.bitfield.set(index, true);
  }

  _hasAllPieces () {
    for (let index = 0; index < this.pieces.length; index++) {
      if (!this.bitfield.get(index)) return false
    }
    return true
  }

  _hasNoPieces () {
    return !this._hasMorePieces(0)
  }

  _hasMorePieces (threshold) {
    let count = 0;
    for (let index = 0; index < this.pieces.length; index++) {
      if (this.bitfield.get(index)) {
        count += 1;
        if (count > threshold) return true
      }
    }
    return false
  }

  /**
   * Called when the metadata, listening server, and underlying chunk store is initialized.
   */
  _onStore () {
    if (this.destroyed) return
    this._debug('on store');

    // Start discovery before emitting 'ready'
    this._startDiscovery();

    this.ready = true;
    this.emit('ready');

    // Files may start out done if the file was already in the store
    this._checkDone();

    // In case any selections were made before torrent was ready
    this._updateSelections();

    // Start requesting pieces after we have initially verified them
    this.wires.forEach(wire => {
      // If we didn't have the metadata at the time ut_metadata was initialized for this
      // wire, we still want to make it available to the peer in case they request it.
      if (wire.ut_metadata) wire.ut_metadata.setMetadata(this.metadata);

      this._onWireWithMetadata(wire);
    });
  }

  destroy (opts, cb) {
    if (typeof opts === 'function') return this.destroy(null, opts)

    this._destroy(null, opts, cb);
  }

  _destroy (err, opts, cb) {
    if (typeof opts === 'function') return this._destroy(err, null, opts)
    if (this.destroyed) return
    this.destroyed = true;
    this._debug('destroy');

    this.client._remove(this);

    clearInterval(this._rechokeIntervalId);

    this._xsRequests.forEach(req => {
      req.abort();
    });

    if (this._rarityMap) {
      this._rarityMap.destroy();
    }

    for (const id in this._peers) {
      this.removePeer(id);
    }

    this.files.forEach(file => {
      if (file instanceof File) file._destroy();
    });

    const tasks = this._servers.map(server => cb => {
      server.destroy(cb);
    });

    if (this.discovery) {
      tasks.push(cb => {
        this.discovery.destroy(cb);
      });
    }

    if (this.store) {
      let destroyStore = this._destroyStoreOnDestroy;
      if (opts && opts.destroyStore !== undefined) {
        destroyStore = opts.destroyStore;
      }
      tasks.push(cb => {
        if (destroyStore) {
          this.store.destroy(cb);
        } else {
          this.store.close(cb);
        }
      });
    }

    parallel$1(tasks, cb);

    if (err) {
      // Torrent errors are emitted at `torrent.on('error')`. If there are no 'error'
      // event handlers on the torrent instance, then the error will be emitted at
      // `client.on('error')`. This prevents throwing an uncaught exception
      // (unhandled 'error' event), but it makes it impossible to distinguish client
      // errors versus torrent errors. Torrent errors are not fatal, and the client
      // is still usable afterwards. Therefore, always listen for errors in both
      // places (`client.on('error')` and `torrent.on('error')`).
      if (this.listenerCount('error') === 0) {
        this.client.emit('error', err);
      } else {
        this.emit('error', err);
      }
    }

    this.emit('close');

    this.client = null;
    this.files = [];
    this.discovery = null;
    this.store = null;
    this._rarityMap = null;
    this._peers = null;
    this._servers = null;
    this._xsRequests = null;
  }

  addPeer (peer) {
    if (this.destroyed) throw new Error('torrent is destroyed')
    if (!this.infoHash) throw new Error('addPeer() must not be called before the `infoHash` event')

    let host;

    if (this.client.blocked) {
      if (typeof peer === 'string') {
        let parts;
        try {
          parts = addrToIPPort(peer);
        } catch (e) {
          this._debug('ignoring peer: invalid %s', peer);
          this.emit('invalidPeer', peer);
          return false
        }
        host = parts[0];
      } else if (typeof peer.remoteAddress === 'string') {
        host = peer.remoteAddress;
      }

      if (host && this.client.blocked.contains(host)) {
        this._debug('ignoring peer: blocked %s', peer);
        if (typeof peer !== 'string') peer.destroy();
        this.emit('blockedPeer', peer);
        return false
      }
    }

    // if the utp connection fails to connect, then it is replaced with a tcp connection to the same ip:port

    const type = (this.client.utp && this._isIPv4(host)) ? 'utp' : 'tcp';
    const wasAdded = !!this._addPeer(peer, type);

    if (wasAdded) {
      this.emit('peer', peer);
    } else {
      this.emit('invalidPeer', peer);
    }
    return wasAdded
  }

  _addPeer (peer, type) {
    if (this.destroyed) {
      if (typeof peer !== 'string') peer.destroy();
      return null
    }
    if (typeof peer === 'string' && !this._validAddr(peer)) {
      this._debug('ignoring peer: invalid %s', peer);
      return null
    }

    const id = (peer && peer.id) || peer;
    if (this._peers[id]) {
      this._debug('ignoring peer: duplicate (%s)', id);
      if (typeof peer !== 'string') peer.destroy();
      return null
    }

    if (this.paused) {
      this._debug('ignoring peer: torrent is paused');
      if (typeof peer !== 'string') peer.destroy();
      return null
    }

    this._debug('add peer %s', id);

    let newPeer;
    if (typeof peer === 'string') {
      // `peer` is an addr ("ip:port" string)
      newPeer = type === 'utp'
        ? Peer$1.createUTPOutgoingPeer(peer, this, this.client.throttleGroups)
        : Peer$1.createTCPOutgoingPeer(peer, this, this.client.throttleGroups);
    } else {
      // `peer` is a WebRTC connection (simple-peer)
      newPeer = Peer$1.createWebRTCPeer(peer, this, this.client.throttleGroups);
    }

    this._registerPeer(newPeer);

    if (typeof peer === 'string') {
      // `peer` is an addr ("ip:port" string)
      this._queue.push(newPeer);
      this._drain();
    }

    return newPeer
  }

  addWebSeed (urlOrConn) {
    if (this.destroyed) throw new Error('torrent is destroyed')

    let id;
    let conn;
    if (typeof urlOrConn === 'string') {
      id = urlOrConn;

      if (!/^https?:\/\/.+/.test(id)) {
        this.emit('warning', new Error(`ignoring invalid web seed: ${id}`));
        this.emit('invalidPeer', id);
        return
      }

      if (this._peers[id]) {
        this.emit('warning', new Error(`ignoring duplicate web seed: ${id}`));
        this.emit('invalidPeer', id);
        return
      }

      conn = new WebConn(id, this);
    } else if (urlOrConn && typeof urlOrConn.connId === 'string') {
      conn = urlOrConn;
      id = conn.connId;

      if (this._peers[id]) {
        this.emit('warning', new Error(`ignoring duplicate web seed: ${id}`));
        this.emit('invalidPeer', id);
        return
      }
    } else {
      this.emit('warning', new Error('addWebSeed must be passed a string or connection object with id property'));
      return
    }

    this._debug('add web seed %s', id);

    const newPeer = Peer$1.createWebSeedPeer(conn, id, this, this.client.throttleGroups);

    this._registerPeer(newPeer);

    this.emit('peer', id);
  }

  /**
   * Called whenever a new incoming TCP peer connects to this torrent swarm. Called with a
   * peer that has already sent a handshake.
   */
  _addIncomingPeer (peer) {
    if (this.destroyed) return peer.destroy(new Error('torrent is destroyed'))
    if (this.paused) return peer.destroy(new Error('torrent is paused'))

    this._debug('add incoming peer %s', peer.id);

    this._registerPeer(peer);
  }

  _registerPeer (newPeer) {
    newPeer.on('download', downloaded => {
      if (this.destroyed) return
      this.received += downloaded;
      this._downloadSpeed(downloaded);
      this.client._downloadSpeed(downloaded);
      this.emit('download', downloaded);
      if (this.destroyed) return
      this.client.emit('download', downloaded);
    });

    newPeer.on('upload', uploaded => {
      if (this.destroyed) return
      this.uploaded += uploaded;
      this._uploadSpeed(uploaded);
      this.client._uploadSpeed(uploaded);
      this.emit('upload', uploaded);
      if (this.destroyed) return
      this.client.emit('upload', uploaded);
    });

    this._peers[newPeer.id] = newPeer;
    this._peersLength += 1;
  }

  removePeer (peer) {
    const id = peer?.id || peer;
    if (peer && !peer.id) peer = this._peers?.[id];

    if (!peer) return
    peer.destroy();

    if (this.destroyed) return

    this._debug('removePeer %s', id);

    delete this._peers[id];
    this._peersLength -= 1;

    // If torrent swarm was at capacity before, try to open a new connection now
    this._drain();
  }

  select (start, end, priority, notify) {
    if (this.destroyed) throw new Error('torrent is destroyed')

    if (start < 0 || end < start || this.pieces.length <= end) {
      throw new Error(`invalid selection ${start} : ${end}`)
    }
    priority = Number(priority) || 0;

    this._debug('select %s-%s (priority %s)', start, end, priority);

    this._selections.push({
      from: start,
      to: end,
      offset: 0,
      priority,
      notify: notify || noop
    });

    this._selections.sort((a, b) => b.priority - a.priority);

    this._updateSelections();
  }

  deselect (start, end, priority) {
    if (this.destroyed) throw new Error('torrent is destroyed')

    priority = Number(priority) || 0;
    this._debug('deselect %s-%s (priority %s)', start, end, priority);

    for (let i = 0; i < this._selections.length; ++i) {
      const s = this._selections[i];
      if (s.from === start && s.to === end && s.priority === priority) {
        this._selections.splice(i, 1);
        break
      }
    }

    this._updateSelections();
  }

  critical (start, end) {
    if (this.destroyed) throw new Error('torrent is destroyed')

    this._debug('critical %s-%s', start, end);

    for (let i = start; i <= end; ++i) {
      this._critical[i] = true;
    }

    this._updateSelections();
  }

  _onWire (wire, addr) {
    this._debug('got wire %s (%s)', wire._debugId, addr || 'Unknown');

    this.wires.push(wire);

    if (addr) {
      // Sometimes RTCPeerConnection.getStats() doesn't return an ip:port for peers
      const parts = addrToIPPort(addr);
      wire.remoteAddress = parts[0];
      wire.remotePort = parts[1];
    }

    // When peer sends PORT message, add that DHT node to routing table
    if (this.client.dht && this.client.dht.listening) {
      wire.on('port', port => {
        if (this.destroyed || this.client.dht.destroyed) {
          return
        }
        if (!wire.remoteAddress) {
          return this._debug('ignoring PORT from peer with no address')
        }
        if (port === 0 || port > 65536) {
          return this._debug('ignoring invalid PORT from peer')
        }

        this._debug('port: %s (from %s)', port, addr);
        this.client.dht.addNode({ host: wire.remoteAddress, port });
      });
    }

    wire.on('timeout', () => {
      this._debug('wire timeout (%s)', addr);
      // TODO: this might be destroying wires too eagerly
      wire.destroy();
    });

    // Timeout for piece requests to this peer
    if (wire.type !== 'webSeed') { // webseeds always send 'unhave' on http timeout
      wire.setTimeout(PIECE_TIMEOUT, true);
    }

    // Send KEEP-ALIVE (every 60s) so peers will not disconnect the wire
    wire.setKeepAlive(true);

    // use ut_metadata extension
    wire.use(utMetadata(this.metadata));

    wire.ut_metadata.on('warning', err => {
      this._debug('ut_metadata warning: %s', err.message);
    });

    if (!this.metadata) {
      wire.ut_metadata.on('metadata', metadata => {
        this._debug('got metadata via ut_metadata');
        this._onMetadata(metadata);
      });
      wire.ut_metadata.fetch();
    }

    // use ut_pex extension if the torrent is not flagged as private
    if (typeof utPex === 'function' && !this.private) {
      wire.use(utPex());

      wire.ut_pex.on('peer', peer => {
        // Only add potential new peers when we're not seeding
        if (this.done) return
        this._debug('ut_pex: got peer: %s (from %s)', peer, addr);
        this.addPeer(peer);
      });

      wire.ut_pex.on('dropped', peer => {
        // the remote peer believes a given peer has been dropped from the torrent swarm.
        // if we're not currently connected to it, then remove it from the queue.
        const peerObj = this._peers[peer];
        if (peerObj && !peerObj.connected) {
          this._debug('ut_pex: dropped peer: %s (from %s)', peer, addr);
          this.removePeer(peer);
        }
      });

      wire.once('close', () => {
        // Stop sending updates to remote peer
        wire.ut_pex.reset();
      });
    }

    wire.use(ltDontHave());

    // Hook to allow user-defined `bittorrent-protocol` extensions
    // More info: https://github.com/webtorrent/bittorrent-protocol#extension-api
    this.emit('wire', wire, addr);

    if (this.ready) {
      queueMicrotask$1(() => {
        // This allows wire.handshake() to be called (by Peer.onHandshake) before any
        // messages get sent on the wire
        this._onWireWithMetadata(wire);
      });
    }
  }

  _onWireWithMetadata (wire) {
    let timeoutId = null;

    const onChokeTimeout = () => {
      if (this.destroyed || wire.destroyed) return

      if (this._numQueued > 2 * (this._numConns - this.numPeers) &&
        wire.amInterested) {
        wire.destroy();
      } else {
        timeoutId = setTimeout(onChokeTimeout, CHOKE_TIMEOUT);
        if (timeoutId.unref) timeoutId.unref();
      }
    };

    let i;
    const updateSeedStatus = () => {
      if (wire.peerPieces.buffer.length !== this.bitfield.buffer.length) return
      for (i = 0; i < this.pieces.length; ++i) {
        if (!wire.peerPieces.get(i)) return
      }
      wire.isSeeder = true;
      wire.choke(); // always choke seeders
    };

    wire.on('bitfield', () => {
      updateSeedStatus();
      this._update();
      this._updateWireInterest(wire);
    });

    wire.on('have', () => {
      updateSeedStatus();
      this._update();
      this._updateWireInterest(wire);
    });

    wire.lt_donthave.on('donthave', () => {
      updateSeedStatus();
      this._update();
      this._updateWireInterest(wire);
    });

    // fast extension (BEP6)
    wire.on('have-all', () => {
      wire.isSeeder = true;
      wire.choke(); // always choke seeders
      this._update();
      this._updateWireInterest(wire);
    });

    // fast extension (BEP6)
    wire.on('have-none', () => {
      wire.isSeeder = false;
      this._update();
      this._updateWireInterest(wire);
    });

    // fast extension (BEP6)
    wire.on('allowed-fast', (index) => {
      this._update();
    });

    wire.once('interested', () => {
      wire.unchoke();
    });

    wire.once('close', () => {
      clearTimeout(timeoutId);
    });

    wire.on('choke', () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(onChokeTimeout, CHOKE_TIMEOUT);
      if (timeoutId.unref) timeoutId.unref();
    });

    wire.on('unchoke', () => {
      clearTimeout(timeoutId);
      this._update();
    });

    wire.on('request', (index, offset, length, cb) => {
      if (length > MAX_BLOCK_LENGTH) {
        // Per spec, disconnect from peers that request >128KB
        return wire.destroy()
      }
      if (this.pieces[index]) return
      this.store.get(index, { offset, length }, cb);
    });

    // always send bitfield or equivalent fast extension message (required)
    if (wire.hasFast && this._hasAllPieces()) wire.haveAll();
    else if (wire.hasFast && this._hasNoPieces()) wire.haveNone();
    else wire.bitfield(this.bitfield);

    // initialize interest in case bitfield message was already received before above handler was registered
    this._updateWireInterest(wire);

    // Send PORT message to peers that support DHT
    if (wire.peerExtensions.dht && this.client.dht && this.client.dht.listening) {
      wire.port(this.client.dht.address().port);
    }

    if (wire.type !== 'webSeed') { // do not choke on webseeds
      timeoutId = setTimeout(onChokeTimeout, CHOKE_TIMEOUT);
      if (timeoutId.unref) timeoutId.unref();
    }

    wire.isSeeder = false;
    updateSeedStatus();
  }

  /**
   * Called on selection changes.
   */
  _updateSelections () {
    if (!this.ready || this.destroyed) return

    queueMicrotask$1(() => {
      this._gcSelections();
    });
    this._updateInterest();
    this._update();
  }

  /**
   * Garbage collect selections with respect to the store's current state.
   */
  _gcSelections () {
    for (let i = 0; i < this._selections.length; ++i) {
      const s = this._selections[i];
      const oldOffset = s.offset;

      // check for newly downloaded pieces in selection
      while (this.bitfield.get(s.from + s.offset) && s.from + s.offset < s.to) {
        s.offset += 1;
      }

      if (oldOffset !== s.offset) s.notify();
      if (s.to !== s.from + s.offset) continue
      if (!this.bitfield.get(s.from + s.offset)) continue

      this._selections.splice(i, 1); // remove fully downloaded selection
      i -= 1; // decrement i to offset splice

      s.notify();
      this._updateInterest();
    }

    if (!this._selections.length) this.emit('idle');
  }

  /**
   * Update interested status for all peers.
   */
  _updateInterest () {
    const prev = this._amInterested;
    this._amInterested = !!this._selections.length;

    this.wires.forEach(wire => this._updateWireInterest(wire));

    if (prev === this._amInterested) return
    if (this._amInterested) this.emit('interested');
    else this.emit('uninterested');
  }

  _updateWireInterest (wire) {
    let interested = false;
    for (let index = 0; index < this.pieces.length; ++index) {
      if (this.pieces[index] && wire.peerPieces.get(index)) {
        interested = true;
        break
      }
    }

    if (interested) wire.interested();
    else wire.uninterested();
  }

  /**
   * Heartbeat to update all peers and their requests.
   */
  _update () {
    if (this.destroyed) return

    // update wires in random order for better request distribution
    const ite = randomIterate(this.wires);
    let wire;
    while ((wire = ite())) {
      this._updateWireWrapper(wire);
    }
  }

  _updateWireWrapper (wire) {
    const self = this;

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => { self._updateWire(wire); }, { timeout: 250 });
    } else {
      self._updateWire(wire);
    }
  }

  /**
   * Attempts to update a peer's requests
   */
  _updateWire (wire) {
    if (wire.destroyed) return false
    // to allow function hoisting
    const self = this;

    const minOutstandingRequests = getBlockPipelineLength(wire, PIPELINE_MIN_DURATION);
    if (wire.requests.length >= minOutstandingRequests) return
    const maxOutstandingRequests = getBlockPipelineLength(wire, PIPELINE_MAX_DURATION);

    if (wire.peerChoking) {
      if (wire.hasFast && wire.peerAllowedFastSet.length > 0 &&
        !this._hasMorePieces(wire.peerAllowedFastSet.length - 1)) {
        requestAllowedFastSet();
      }
      return
    }

    if (!wire.downloaded) return validateWire()

    trySelectWire(false) || trySelectWire(true);

    function requestAllowedFastSet () {
      if (wire.requests.length >= maxOutstandingRequests) return false

      for (const piece of wire.peerAllowedFastSet) {
        if (wire.peerPieces.get(piece) && !self.bitfield.get(piece)) {
          while (self._request(wire, piece, false) &&
            wire.requests.length < maxOutstandingRequests) {
            // body intentionally empty
            // request all non-reserved blocks in this piece
          }
        }

        if (wire.requests.length < maxOutstandingRequests) continue

        return true
      }

      return false
    }

    function genPieceFilterFunc (start, end, tried, rank) {
      return i => i >= start && i <= end && !(i in tried) && wire.peerPieces.get(i) && (!rank || rank(i))
    }

    // TODO: Do we need both validateWire and trySelectWire?
    function validateWire () {
      if (wire.requests.length) return

      let i = self._selections.length;
      while (i--) {
        const next = self._selections[i];
        let piece;
        if (self.strategy === 'rarest') {
          const start = next.from + next.offset;
          const end = next.to;
          const len = end - start + 1;
          const tried = {};
          let tries = 0;
          const filter = genPieceFilterFunc(start, end, tried);

          while (tries < len) {
            piece = self._rarityMap.getRarestPiece(filter);
            if (piece < 0) break
            if (self._request(wire, piece, false)) return
            tried[piece] = true;
            tries += 1;
          }
        } else {
          for (piece = next.to; piece >= next.from + next.offset; --piece) {
            if (!wire.peerPieces.get(piece)) continue
            if (self._request(wire, piece, false)) return
          }
        }
      }

      // TODO: wire failed to validate as useful; should we close it?
      // probably not, since 'have' and 'bitfield' messages might be coming
    }

    function speedRanker () {
      const speed = wire.downloadSpeed() || 1;
      if (speed > SPEED_THRESHOLD) return () => true

      const secs = Math.max(1, wire.requests.length) * Piece.BLOCK_LENGTH / speed;
      let tries = 10;
      let ptr = 0;

      return index => {
        if (!tries || self.bitfield.get(index)) return true

        let missing = self.pieces[index].missing;

        for (; ptr < self.wires.length; ptr++) {
          const otherWire = self.wires[ptr];
          const otherSpeed = otherWire.downloadSpeed();

          if (otherSpeed < SPEED_THRESHOLD) continue
          if (otherSpeed <= speed) continue
          if (!otherWire.peerPieces.get(index)) continue
          if ((missing -= otherSpeed * secs) > 0) continue

          tries--;
          return false
        }

        return true
      }
    }

    function shufflePriority (i) {
      let last = i;
      for (let j = i; j < self._selections.length && self._selections[j].priority; j++) {
        last = j;
      }
      const tmp = self._selections[i];
      self._selections[i] = self._selections[last];
      self._selections[last] = tmp;
    }

    function trySelectWire (hotswap) {
      if (wire.requests.length >= maxOutstandingRequests) return true
      const rank = speedRanker();

      for (let i = 0; i < self._selections.length; i++) {
        const next = self._selections[i];

        let piece;
        if (self.strategy === 'rarest') {
          const start = next.from + next.offset;
          const end = next.to;
          const len = end - start + 1;
          const tried = {};
          let tries = 0;
          const filter = genPieceFilterFunc(start, end, tried, rank);

          while (tries < len) {
            piece = self._rarityMap.getRarestPiece(filter);
            if (piece < 0) break

            while (self._request(wire, piece, self._critical[piece] || hotswap) &&
              wire.requests.length < maxOutstandingRequests) {
              // body intentionally empty
              // request all non-reserved blocks in this piece
            }

            if (wire.requests.length < maxOutstandingRequests) {
              tried[piece] = true;
              tries++;
              continue
            }

            if (next.priority) shufflePriority(i);
            return true
          }
        } else {
          for (piece = next.from + next.offset; piece <= next.to; piece++) {
            if (!wire.peerPieces.get(piece) || !rank(piece)) continue

            while (self._request(wire, piece, self._critical[piece] || hotswap) &&
              wire.requests.length < maxOutstandingRequests) {
              // body intentionally empty
              // request all non-reserved blocks in piece
            }

            if (wire.requests.length < maxOutstandingRequests) continue

            if (next.priority) shufflePriority(i);
            return true
          }
        }
      }

      return false
    }
  }

  /**
   * Called periodically to update the choked status of all peers, handling optimistic
   * unchoking as described in BEP3.
   */
  _rechoke () {
    if (!this.ready) return

    // wires in increasing order of quality (pop() gives next best peer)
    const wireStack =
      this.wires
        .map(wire => ({ wire, random: Math.random() })) // insert a random seed for randomizing the sort
        .sort((objA, objB) => {
          const wireA = objA.wire;
          const wireB = objB.wire;

          // prefer peers that send us data faster
          if (wireA.downloadSpeed() !== wireB.downloadSpeed()) {
            return wireA.downloadSpeed() - wireB.downloadSpeed()
          }

          // then prefer peers that can download data from us faster
          if (wireA.uploadSpeed() !== wireB.uploadSpeed()) {
            return wireA.uploadSpeed() - wireB.uploadSpeed()
          }

          // then prefer already unchoked peers (to minimize fibrillation)
          if (wireA.amChoking !== wireB.amChoking) {
            return wireA.amChoking ? -1 : 1 // choking < unchoked
          }

          // otherwise random order
          return objA.random - objB.random
        })
        .map(obj => obj.wire); // return array of wires (remove random seed)

    if (this._rechokeOptimisticTime <= 0) {
      // clear old optimistic peer, so it can be rechoked normally and then replaced
      this._rechokeOptimisticWire = null;
    } else {
      this._rechokeOptimisticTime -= 1;
    }

    let numInterestedUnchoked = 0;
    // leave one rechoke slot open for optimistic unchoking
    while (wireStack.length > 0 && numInterestedUnchoked < this._rechokeNumSlots - 1) {
      const wire = wireStack.pop(); // next best quality peer

      if (wire.isSeeder || wire === this._rechokeOptimisticWire) {
        continue
      }

      wire.unchoke();

      // only stop unchoking once we fill the slots with interested peers that will actually download
      if (wire.peerInterested) {
        numInterestedUnchoked++;
      }
    }

    // fill optimistic unchoke slot if empty
    if (this._rechokeOptimisticWire === null && this._rechokeNumSlots > 0) {
      // don't optimistically unchoke uninterested peers
      const remaining = wireStack.filter(wire => wire.peerInterested);

      if (remaining.length > 0) {
        // select random remaining (not yet unchoked) peer
        const newOptimisticPeer = remaining[randomInt(remaining.length)];

        newOptimisticPeer.unchoke();

        this._rechokeOptimisticWire = newOptimisticPeer;

        this._rechokeOptimisticTime = RECHOKE_OPTIMISTIC_DURATION;
      }
    }

    // choke the rest
    wireStack
      .filter(wire => wire !== this._rechokeOptimisticWire) // except the optimistically unchoked peer
      .forEach(wire => wire.choke());
  }

  /**
   * Attempts to cancel a slow block request from another wire such that the
   * given wire may effectively swap out the request for one of its own.
   */
  _hotswap (wire, index) {
    const speed = wire.downloadSpeed();
    if (speed < Piece.BLOCK_LENGTH) return false
    if (!this._reservations[index]) return false

    const r = this._reservations[index];
    if (!r) {
      return false
    }

    let minSpeed = Infinity;
    let minWire;

    let i;
    for (i = 0; i < r.length; i++) {
      const otherWire = r[i];
      if (!otherWire || otherWire === wire) continue

      const otherSpeed = otherWire.downloadSpeed();
      if (otherSpeed >= SPEED_THRESHOLD) continue
      if (2 * otherSpeed > speed || otherSpeed > minSpeed) continue

      minWire = otherWire;
      minSpeed = otherSpeed;
    }

    if (!minWire) return false

    for (i = 0; i < r.length; i++) {
      if (r[i] === minWire) r[i] = null;
    }

    for (i = 0; i < minWire.requests.length; i++) {
      const req = minWire.requests[i];
      if (req.piece !== index) continue

      this.pieces[index].cancel((req.offset / Piece.BLOCK_LENGTH) | 0);
    }

    this.emit('hotswap', minWire, wire, index);
    return true
  }

  /**
   * Attempts to request a block from the given wire.
   */
  _request (wire, index, hotswap) {
    const self = this;
    const numRequests = wire.requests.length;
    const isWebSeed = wire.type === 'webSeed';

    if (self.bitfield.get(index)) return false

    const maxOutstandingRequests = isWebSeed
      ? Math.min(
        getPiecePipelineLength(wire, PIPELINE_MAX_DURATION, self.pieceLength),
        self.maxWebConns
      )
      : getBlockPipelineLength(wire, PIPELINE_MAX_DURATION);

    if (numRequests >= maxOutstandingRequests) return false
    // var endGame = (wire.requests.length === 0 && self.store.numMissing < 30)

    const piece = self.pieces[index];
    let reservation = isWebSeed ? piece.reserveRemaining() : piece.reserve();

    if (reservation === -1 && hotswap && self._hotswap(wire, index)) {
      reservation = isWebSeed ? piece.reserveRemaining() : piece.reserve();
    }
    if (reservation === -1) return false

    let r = self._reservations[index];
    if (!r) r = self._reservations[index] = [];
    let i = r.indexOf(null);
    if (i === -1) i = r.length;
    r[i] = wire;

    const chunkOffset = piece.chunkOffset(reservation);
    const chunkLength = isWebSeed ? piece.chunkLengthRemaining(reservation) : piece.chunkLength(reservation);

    wire.request(index, chunkOffset, chunkLength, function onChunk (err, chunk) {
      if (self.destroyed) return

      // TODO: what is this for?
      if (!self.ready) return self.once('ready', () => { onChunk(err, chunk); })

      if (r[i] === wire) r[i] = null;

      if (piece !== self.pieces[index]) return onUpdateTick()

      if (err) {
        self._debug(
          'error getting piece %s (offset: %s length: %s) from %s: %s',
          index, chunkOffset, chunkLength, `${wire.remoteAddress}:${wire.remotePort}`,
          err.message
        );
        isWebSeed ? piece.cancelRemaining(reservation) : piece.cancel(reservation);
        onUpdateTick();
        return
      }

      self._debug(
        'got piece %s (offset: %s length: %s) from %s',
        index, chunkOffset, chunkLength, `${wire.remoteAddress}:${wire.remotePort}`
      );

      if (!piece.set(reservation, chunk, wire)) return onUpdateTick()

      const buf = piece.flush();

      // TODO: might need to set self.pieces[index] = null here since sha1 is async

      sha1$1(buf, hash => {
        if (self.destroyed) return

        if (hash === self._hashes[index]) {
          self._debug('piece verified %s', index);

          self.store.put(index, buf, err => {
            if (err) {
              self._destroy(err);
              return
            } else {
              self.pieces[index] = null;
              self._markVerified(index);
              self.wires.forEach(wire => {
                wire.have(index);
              });
            }
            // We also check `self.destroyed` since `torrent.destroy()` could have been
            // called in the `torrent.on('done')` handler, triggered by `_checkDone()`.
            if (self._checkDone() && !self.destroyed) self.discovery.complete();
            onUpdateTick();
          });
        } else {
          self.pieces[index] = new Piece(piece.length);
          self.emit('warning', new Error(`Piece ${index} failed verification`));
          onUpdateTick();
        }
      });
    });

    function onUpdateTick () {
      queueMicrotask$1(() => { self._update(); });
    }

    return true
  }

  _checkDone () {
    if (this.destroyed) return

    // are any new files done?
    this.files.forEach(file => {
      if (file.done) return
      for (let i = file._startPiece; i <= file._endPiece; ++i) {
        if (!this.bitfield.get(i)) return
      }
      file.done = true;
      file.emit('done');
      this._debug(`file done: ${file.name}`);
    });

    // is the torrent done? (if all current selections are satisfied, or there are
    // no selections, then torrent is done)
    let done = true;

    for (const selection of this._selections) {
      for (let piece = selection.from; piece <= selection.to; piece++) {
        if (!this.bitfield.get(piece)) {
          done = false;
          break
        }
      }
      if (!done) break
    }

    if (!this.done && done) {
      this.done = true;
      this._debug(`torrent done: ${this.infoHash}`);
      this.emit('done');
    } else {
      this.done = false;
    }
    this._gcSelections();

    return done
  }

  load (streams, cb) {
    if (this.destroyed) throw new Error('torrent is destroyed')
    if (!this.ready) return this.once('ready', () => { this.load(streams, cb); })

    if (!Array.isArray(streams)) streams = [streams];
    if (!cb) cb = noop;

    const readable = Readable.from(joinIterator(streams));
    const writable = new ChunkStoreWriteStream(this.store, this.pieceLength);

    pump(readable, writable, err => {
      if (err) return cb(err)
      this._markAllVerified();
      this._checkDone();
      cb(null);
    });
  }

  createServer (requestListener) {
    if (typeof Server !== 'function') throw new Error('node.js-only method')
    if (this.destroyed) throw new Error('torrent is destroyed')
    const server = new Server(this, requestListener);
    this._servers.push(server);
    return server
  }

  pause () {
    if (this.destroyed) return
    this._debug('pause');
    this.paused = true;
  }

  resume () {
    if (this.destroyed) return
    this._debug('resume');
    this.paused = false;
    this._drain();
  }

  _debug () {
    const args = [].slice.call(arguments);
    args[0] = `[${this.client ? this.client._debugId : 'No Client'}] [${this._debugId}] ${args[0]}`;
    debug$1(...args);
  }

  /**
   * Pop a peer off the FIFO queue and connect to it. When _drain() gets called,
   * the queue will usually have only one peer in it, except when there are too
   * many peers (over `this.maxConns`) in which case they will just sit in the
   * queue until another connection closes.
   */
  _drain () {
    this._debug('_drain numConns %s maxConns %s', this._numConns, this.client.maxConns);
    if (typeof net.connect !== 'function' || this.destroyed || this.paused ||
        this._numConns >= this.client.maxConns) {
      return
    }
    this._debug('drain (%s queued, %s/%s peers)', this._numQueued, this.numPeers, this.client.maxConns);

    const peer = this._queue.shift();
    if (!peer) return // queue could be empty

    this._debug('%s connect attempt to %s', peer.type, peer.addr);

    const parts = addrToIPPort(peer.addr);
    const opts = {
      host: parts[0],
      port: parts[1]
    };

    if (this.client.utp && peer.type === 'utpOutgoing') {
      peer.conn = utp.connect(opts.port, opts.host);
    } else {
      peer.conn = net.connect(opts);
    }

    const conn = peer.conn;

    conn.once('connect', () => { if (!this.destroyed) peer.onConnect(); });
    conn.once('error', err => { peer.destroy(err); });
    peer.startConnectTimeout();

    // When connection closes, attempt reconnect after timeout (with exponential backoff)
    conn.on('close', () => {
      if (this.destroyed) return

      if (peer.retries >= RECONNECT_WAIT.length) {
        if (this.client.utp) {
          const newPeer = this._addPeer(peer.addr, 'tcp');
          if (newPeer) newPeer.retries = 0;
        } else {
          this._debug(
            'conn %s closed: will not re-add (max %s attempts)',
            peer.addr, RECONNECT_WAIT.length
          );
        }
        return
      }

      const ms = RECONNECT_WAIT[peer.retries];
      this._debug(
        'conn %s closed: will re-add to queue in %sms (attempt %s)',
        peer.addr, ms, peer.retries + 1
      );

      const reconnectTimeout = setTimeout(() => {
        if (this.destroyed) return
        const host = addrToIPPort(peer.addr)[0];
        const type = (this.client.utp && this._isIPv4(host)) ? 'utp' : 'tcp';
        const newPeer = this._addPeer(peer.addr, type);
        if (newPeer) newPeer.retries = peer.retries + 1;
      }, ms);
      if (reconnectTimeout.unref) reconnectTimeout.unref();
    });
  }

  /**
   * Returns `true` if string is valid IPv4/6 address.
   * @param {string} addr
   * @return {boolean}
   */
  _validAddr (addr) {
    let parts;
    try {
      parts = addrToIPPort(addr);
    } catch (e) {
      return false
    }
    const host = parts[0];
    const port = parts[1];
    return port > 0 && port < 65535 &&
      !(host === '127.0.0.1' && port === this.client.torrentPort)
  }

  /**
   * Return `true` if string is a valid IPv4 address.
   * @param {string} addr
   * @return {boolean}
   */
  _isIPv4 (addr) {
    const IPv4Pattern = /^((?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])[.]){3}(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])$/;
    return IPv4Pattern.test(addr)
  }
};

function getBlockPipelineLength (wire, duration) {
  let length = 2 + Math.ceil(duration * wire.downloadSpeed() / Piece.BLOCK_LENGTH);

  // Honor reqq (maximum number of outstanding request messages) if specified by peer
  if (wire.peerExtendedHandshake) {
    const reqq = wire.peerExtendedHandshake.reqq;
    if (typeof reqq === 'number' && reqq > 0) {
      length = Math.min(length, reqq);
    }
  }

  return length
}

function getPiecePipelineLength (wire, duration, pieceLength) {
  return 1 + Math.ceil(duration * wire.downloadSpeed() / pieceLength)
}

/**
 * Returns a random integer in [0,high)
 */
function randomInt (high) {
  return Math.random() * high | 0
}

function noop () {}

var torrent = Torrent$1;

/*! webtorrent. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */

/* global FileList, ServiceWorker */
/* eslint-env browser */

const EventEmitter = require$$0;
const path = require$$2$2;
const concat = require$$2$4;
const createTorrent = require$$3$4;
const debugFactory = require$$1$1;
const DHT = require$$5$2; // browser exclude
const loadIPSet = require$$6; // browser exclude
const parallel = require$$18;
const parseTorrent = require$$20;
const Peer = require$$9$2;
const queueMicrotask = require$$2$1;
const randombytes = require$$11$1;
const sha1 = require$$4$2;
const throughput = require$$26;
const { ThrottleGroup } = require$$14$1;
const ConnPool = connPool; // browser exclude
const Torrent = torrent;

const debug = debugFactory('webtorrent');

/**
 * Version number in Azureus-style. Generated from major and minor semver version.
 * For example:
 *   '0.16.1' -> '0016'
 *   '1.2.5' -> '0102'
 */
const VERSION_STR = '0197';

/**
 * Version prefix string (used in peer ID). WebTorrent uses the Azureus-style
 * encoding: '-', two characters for client id ('WW'), four ascii digits for version
 * number, '-', followed by random numbers.
 * For example:
 *   '-WW0102-'...
 */
const VERSION_PREFIX = `-WW${VERSION_STR}-`;

/**
 * WebTorrent Client
 * @param {Object=} opts
 */
class WebTorrent extends EventEmitter {
  constructor (opts = {}) {
    super();

    if (typeof opts.peerId === 'string') {
      this.peerId = opts.peerId;
    } else if (Buffer.isBuffer(opts.peerId)) {
      this.peerId = opts.peerId.toString('hex');
    } else {
      this.peerId = Buffer.from(VERSION_PREFIX + randombytes(9).toString('base64')).toString('hex');
    }
    this.peerIdBuffer = Buffer.from(this.peerId, 'hex');

    if (typeof opts.nodeId === 'string') {
      this.nodeId = opts.nodeId;
    } else if (Buffer.isBuffer(opts.nodeId)) {
      this.nodeId = opts.nodeId.toString('hex');
    } else {
      this.nodeId = randombytes(20).toString('hex');
    }
    this.nodeIdBuffer = Buffer.from(this.nodeId, 'hex');

    this._debugId = this.peerId.toString('hex').substring(0, 7);

    this.destroyed = false;
    this.listening = false;
    this.torrentPort = opts.torrentPort || 0;
    this.dhtPort = opts.dhtPort || 0;
    this.tracker = opts.tracker !== undefined ? opts.tracker : {};
    this.lsd = opts.lsd !== false;
    this.torrents = [];
    this.maxConns = Number(opts.maxConns) || 55;
    this.utp = WebTorrent.UTP_SUPPORT && opts.utp !== false;

    this._downloadLimit = Math.max((typeof opts.downloadLimit === 'number') ? opts.downloadLimit : -1, -1);
    this._uploadLimit = Math.max((typeof opts.uploadLimit === 'number') ? opts.uploadLimit : -1, -1);

    this.serviceWorker = null;
    this.workerKeepAliveInterval = null;
    this.workerPortCount = 0;

    if (opts.secure === true) {
      requirePeer().enableSecure();
    }

    this._debug(
      'new webtorrent (peerId %s, nodeId %s, port %s)',
      this.peerId, this.nodeId, this.torrentPort
    );

    this.throttleGroups = {
      down: new ThrottleGroup({ rate: Math.max(this._downloadLimit, 0), enabled: this._downloadLimit >= 0 }),
      up: new ThrottleGroup({ rate: Math.max(this._uploadLimit, 0), enabled: this._uploadLimit >= 0 })
    };

    if (this.tracker) {
      if (typeof this.tracker !== 'object') this.tracker = {};
      if (globalThis.WRTC && !this.tracker.wrtc) this.tracker.wrtc = globalThis.WRTC;
    }

    if (typeof ConnPool === 'function') {
      this._connPool = new ConnPool(this);
    } else {
      queueMicrotask(() => {
        this._onListening();
      });
    }

    // stats
    this._downloadSpeed = throughput();
    this._uploadSpeed = throughput();

    if (opts.dht !== false && typeof DHT === 'function' /* browser exclude */) {
      // use a single DHT instance for all torrents, so the routing table can be reused
      this.dht = new DHT(Object.assign({}, { nodeId: this.nodeId }, opts.dht));

      this.dht.once('error', err => {
        this._destroy(err);
      });

      this.dht.once('listening', () => {
        const address = this.dht.address();
        if (address) this.dhtPort = address.port;
      });

      // Ignore warning when there are > 10 torrents in the client
      this.dht.setMaxListeners(0);

      this.dht.listen(this.dhtPort);
    } else {
      this.dht = false;
    }

    // Enable or disable BEP19 (Web Seeds). Enabled by default:
    this.enableWebSeeds = opts.webSeeds !== false;

    const ready = () => {
      if (this.destroyed) return
      this.ready = true;
      this.emit('ready');
    };

    if (typeof loadIPSet === 'function' && opts.blocklist != null) {
      loadIPSet(opts.blocklist, {
        headers: {
          'user-agent': `WebTorrent/${VERSION} (https://webtorrent.io)`
        }
      }, (err, ipSet) => {
        if (err) return console.error(`Failed to load blocklist: ${err.message}`)
        this.blocked = ipSet;
        ready();
      });
    } else {
      queueMicrotask(ready);
    }
  }

  /**
   * Accepts an existing service worker registration [navigator.serviceWorker.controller]
   * which must be activated, "creates" a file server for streamed file rendering to use.
   *
   * @param  {ServiceWorker} controller
   * @param {function=} cb
   * @return {null}
   */
  loadWorker (controller, cb = () => {}) {
    if (!(controller instanceof ServiceWorker)) throw new Error('Invalid worker registration')
    if (controller.state !== 'activated') throw new Error('Worker isn\'t activated')
    const keepAliveTime = 20000;

    this.serviceWorker = controller;

    navigator.serviceWorker.addEventListener('message', event => {
      const { data } = event;
      if (!data.type || !data.type === 'webtorrent' || !data.url) return null
      let [infoHash, ...filePath] = data.url.slice(data.url.indexOf(data.scope + 'webtorrent/') + 11 + data.scope.length).split('/');
      filePath = decodeURI(filePath.join('/'));
      if (!infoHash || !filePath) return null

      const [port] = event.ports;

      const file = this.get(infoHash) && this.get(infoHash).files.find(file => file.path === filePath);
      if (!file) return null

      const [response, stream, raw] = file._serve(data);
      const asyncIterator = stream && stream[Symbol.asyncIterator]();

      const cleanup = () => {
        port.onmessage = null;
        if (stream) stream.destroy();
        if (raw) raw.destroy();
        this.workerPortCount--;
        if (!this.workerPortCount) {
          clearInterval(this.workerKeepAliveInterval);
          this.workerKeepAliveInterval = null;
        }
      };

      port.onmessage = async msg => {
        if (msg.data) {
          let chunk;
          try {
            chunk = (await asyncIterator.next()).value;
          } catch (e) {
            // chunk is yet to be downloaded or it somehow failed, should this be logged?
          }
          port.postMessage(chunk);
          if (!chunk) cleanup();
          if (!this.workerKeepAliveInterval) this.workerKeepAliveInterval = setInterval(() => fetch(`${this.serviceWorker.scriptURL.slice(0, this.serviceWorker.scriptURL.lastIndexOf('/') + 1).slice(window.location.origin.length)}webtorrent/keepalive/`), keepAliveTime);
        } else {
          cleanup();
        }
      };
      this.workerPortCount++;
      port.postMessage(response);
    });
    // test if browser supports cancelling sw Readable Streams
    fetch(`${this.serviceWorker.scriptURL.slice(0, this.serviceWorker.scriptURL.lastIndexOf('/') + 1).slice(window.location.origin.length)}webtorrent/cancel/`).then(res => {
      res.body.cancel();
    });
    cb(null, this.serviceWorker);
  }

  get downloadSpeed () { return this._downloadSpeed() }

  get uploadSpeed () { return this._uploadSpeed() }

  get progress () {
    const torrents = this.torrents.filter(torrent => torrent.progress !== 1);
    const downloaded = torrents.reduce((total, torrent) => total + torrent.downloaded, 0);
    const length = torrents.reduce((total, torrent) => total + (torrent.length || 0), 0) || 1;
    return downloaded / length
  }

  get ratio () {
    const uploaded = this.torrents.reduce((total, torrent) => total + torrent.uploaded, 0);
    const received = this.torrents.reduce((total, torrent) => total + torrent.received, 0) || 1;
    return uploaded / received
  }

  /**
   * Returns the torrent with the given `torrentId`. Convenience method. Easier than
   * searching through the `client.torrents` array. Returns `null` if no matching torrent
   * found.
   *
   * @param  {string|Buffer|Object|Torrent} torrentId
   * @return {Torrent|null}
   */
  get (torrentId) {
    if (torrentId instanceof Torrent) {
      if (this.torrents.includes(torrentId)) return torrentId
    } else {
      let parsed;
      try { parsed = parseTorrent(torrentId); } catch (err) {}

      if (!parsed) return null
      if (!parsed.infoHash) throw new Error('Invalid torrent identifier')

      for (const torrent of this.torrents) {
        if (torrent.infoHash === parsed.infoHash) return torrent
      }
    }
    return null
  }

  /**
   * Start downloading a new torrent. Aliased as `client.download`.
   * @param {string|Buffer|Object} torrentId
   * @param {Object} opts torrent-specific options
   * @param {function=} ontorrent called when the torrent is ready (has metadata)
   */
  add (torrentId, opts = {}, ontorrent = () => {}) {
    if (this.destroyed) throw new Error('client is destroyed')
    if (typeof opts === 'function') [opts, ontorrent] = [{}, opts];

    const onInfoHash = () => {
      if (this.destroyed) return
      for (const t of this.torrents) {
        if (t.infoHash === torrent.infoHash && t !== torrent) {
          torrent._destroy(new Error(`Cannot add duplicate torrent ${torrent.infoHash}`));
          ontorrent(t);
          return
        }
      }
    };

    const onReady = () => {
      if (this.destroyed) return
      ontorrent(torrent);
      this.emit('torrent', torrent);
    };

    function onClose () {
      torrent.removeListener('_infoHash', onInfoHash);
      torrent.removeListener('ready', onReady);
      torrent.removeListener('close', onClose);
    }

    this._debug('add');
    opts = opts ? Object.assign({}, opts) : {};

    const torrent = new Torrent(torrentId, this, opts);
    this.torrents.push(torrent);

    torrent.once('_infoHash', onInfoHash);
    torrent.once('ready', onReady);
    torrent.once('close', onClose);

    return torrent
  }

  /**
   * Start seeding a new file/folder.
   * @param  {string|File|FileList|Buffer|Array.<string|File|Buffer>} input
   * @param  {Object=} opts
   * @param  {function=} onseed called when torrent is seeding
   */
  seed (input, opts, onseed) {
    if (this.destroyed) throw new Error('client is destroyed')
    if (typeof opts === 'function') [opts, onseed] = [{}, opts];

    this._debug('seed');
    opts = opts ? Object.assign({}, opts) : {};

    // no need to verify the hashes we create
    opts.skipVerify = true;

    const isFilePath = typeof input === 'string';

    // When seeding from fs path, initialize store from that path to avoid a copy
    if (isFilePath) opts.path = path.dirname(input);
    if (!opts.createdBy) opts.createdBy = `WebTorrent/${VERSION_STR}`;

    const onTorrent = torrent => {
      const tasks = [
        cb => {
          // when a filesystem path is specified or the store is preloaded, files are already in the FS store
          if (isFilePath || opts.preloadedStore) return cb()
          torrent.load(streams, cb);
        }
      ];
      if (this.dht) {
        tasks.push(cb => {
          torrent.once('dhtAnnounce', cb);
        });
      }
      parallel(tasks, err => {
        if (this.destroyed) return
        if (err) return torrent._destroy(err)
        _onseed(torrent);
      });
    };

    const _onseed = torrent => {
      this._debug('on seed');
      if (typeof onseed === 'function') onseed(torrent);
      torrent.emit('seed');
      this.emit('seed', torrent);
    };

    const torrent = this.add(null, opts, onTorrent);
    let streams;

    if (isFileList(input)) input = Array.from(input);
    else if (!Array.isArray(input)) input = [input];

    parallel(input.map(item => cb => {
      if (!opts.preloadedStore && isReadable(item)) {
        concat(item, (err, buf) => {
          if (err) return cb(err)
          buf.name = item.name;
          cb(null, buf);
        });
      } else {
        cb(null, item);
      }
    }), (err, input) => {
      if (this.destroyed) return
      if (err) return torrent._destroy(err)

      createTorrent.parseInput(input, opts, (err, files) => {
        if (this.destroyed) return
        if (err) return torrent._destroy(err)

        streams = files.map(file => file.getStream);

        createTorrent(input, opts, (err, torrentBuf) => {
          if (this.destroyed) return
          if (err) return torrent._destroy(err)

          const existingTorrent = this.get(torrentBuf);
          if (existingTorrent) {
            console.warn('A torrent with the same id is already being seeded');
            torrent._destroy();
            if (typeof onseed === 'function') onseed(existingTorrent);
          } else {
            torrent._onTorrentId(torrentBuf);
          }
        });
      });
    });

    return torrent
  }

  /**
   * Remove a torrent from the client.
   * @param  {string|Buffer|Torrent}   torrentId
   * @param  {function} cb
   */
  remove (torrentId, opts, cb) {
    if (typeof opts === 'function') return this.remove(torrentId, null, opts)

    this._debug('remove');
    const torrent = this.get(torrentId);
    if (!torrent) throw new Error(`No torrent with id ${torrentId}`)
    this._remove(torrentId, opts, cb);
  }

  _remove (torrentId, opts, cb) {
    if (typeof opts === 'function') return this._remove(torrentId, null, opts)

    const torrent = this.get(torrentId);
    if (!torrent) return
    this.torrents.splice(this.torrents.indexOf(torrent), 1);
    torrent.destroy(opts, cb);
    if (this.dht) {
      this.dht._tables.remove(torrent.infoHash);
    }
  }

  address () {
    if (!this.listening) return null
    return this._connPool
      ? this._connPool.tcpServer.address()
      : { address: '0.0.0.0', family: 'IPv4', port: 0 }
  }

  /**
   * Set global download throttle rate.
   * @param  {Number} rate (must be bigger or equal than zero, or -1 to disable throttling)
   */
  throttleDownload (rate) {
    rate = Number(rate);
    if (isNaN(rate) || !isFinite(rate) || rate < -1) return false
    this._downloadLimit = rate;
    if (this._downloadLimit < 0) return this.throttleGroups.down.setEnabled(false)
    this.throttleGroups.down.setEnabled(true);
    this.throttleGroups.down.setRate(this._downloadLimit);
  }

  /**
   * Set global upload throttle rate
   * @param  {Number} rate (must be bigger or equal than zero, or -1 to disable throttling)
   */
  throttleUpload (rate) {
    rate = Number(rate);
    if (isNaN(rate) || !isFinite(rate) || rate < -1) return false
    this._uploadLimit = rate;
    if (this._uploadLimit < 0) return this.throttleGroups.up.setEnabled(false)
    this.throttleGroups.up.setEnabled(true);
    this.throttleGroups.up.setRate(this._uploadLimit);
  }

  /**
   * Destroy the client, including all torrents and connections to peers.
   * @param  {function} cb
   */
  destroy (cb) {
    if (this.destroyed) throw new Error('client already destroyed')
    this._destroy(null, cb);
  }

  _destroy (err, cb) {
    this._debug('client destroy');
    this.destroyed = true;

    const tasks = this.torrents.map(torrent => cb => {
      torrent.destroy(cb);
    });

    if (this._connPool) {
      tasks.push(cb => {
        this._connPool.destroy(cb);
      });
    }

    if (this.dht) {
      tasks.push(cb => {
        this.dht.destroy(cb);
      });
    }

    parallel(tasks, cb);

    if (err) this.emit('error', err);

    this.torrents = [];
    this._connPool = null;
    this.dht = null;

    this.throttleGroups.down.destroy();
    this.throttleGroups.up.destroy();
  }

  _onListening () {
    this._debug('listening');
    this.listening = true;

    if (this._connPool) {
      // Sometimes server.address() returns `null` in Docker.
      const address = this._connPool.tcpServer.address();
      if (address) this.torrentPort = address.port;
    }

    this.emit('listening');
  }

  _debug () {
    const args = [].slice.call(arguments);
    args[0] = `[${this._debugId}] ${args[0]}`;
    debug(...args);
  }

  _getByHash (infoHashHash) {
    for (const torrent of this.torrents) {
      if (!torrent.infoHashHash) {
        torrent.infoHashHash = sha1.sync(Buffer.from('72657132' /* 'req2' */ + torrent.infoHash, 'hex'));
      }
      if (infoHashHash === torrent.infoHashHash) {
        return torrent
      }
    }

    return null
  }
}

WebTorrent.WEBRTC_SUPPORT = Peer.WEBRTC_SUPPORT;
WebTorrent.UTP_SUPPORT = ConnPool.UTP_SUPPORT;
WebTorrent.VERSION = '1.9.7';

/**
 * Check if `obj` is a node Readable stream
 * @param  {*} obj
 * @return {boolean}
 */
function isReadable (obj) {
  return typeof obj === 'object' && obj != null && typeof obj.pipe === 'function'
}

/**
 * Check if `obj` is a W3C `FileList` object
 * @param  {*} obj
 * @return {boolean}
 */
function isFileList (obj) {
  return typeof FileList !== 'undefined' && obj instanceof FileList
}

var webtorrent = WebTorrent;

var index = /*@__PURE__*/getDefaultExportFromCjs(webtorrent);

export { index as default };
