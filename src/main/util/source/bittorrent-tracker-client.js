import require$$4 from 'debug';
import require$$0$1 from 'events';
import require$$2$2 from 'once';
import require$$3$1 from 'run-parallel';
import require$$2$1 from 'simple-peer';
import require$$5$2 from 'queue-microtask';
import require$$0 from 'querystring';
import require$$0$2 from 'unordered-array-remove';
import require$$1 from 'bencode';
import require$$2 from 'clone';
import require$$3 from 'compact2string';
import require$$5 from 'simple-get';
import require$$6 from 'socks';
import require$$1$1 from 'bn.js';
import require$$5$1 from 'dgram';
import require$$6$1 from './randombytes';
import require$$4$1 from './simple-websocket';

function getDefaultExportFromCjs (x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var common$4 = {};

var commonNode = {};

/**
 * Functions/constants needed by both the client and server (but only in node).
 * These are separate from common.js so they can be skipped when bundling for the browser.
 */

const querystring = require$$0;

commonNode.IPV4_RE = /^[\d.]+$/;
commonNode.IPV6_RE = /^[\da-fA-F:]+$/;
commonNode.REMOVE_IPV4_MAPPED_IPV6_RE = /^::ffff:/;

commonNode.CONNECTION_ID = Buffer.concat([toUInt32(0x417), toUInt32(0x27101980)]);
commonNode.ACTIONS = { CONNECT: 0, ANNOUNCE: 1, SCRAPE: 2, ERROR: 3 };
commonNode.EVENTS = { update: 0, completed: 1, started: 2, stopped: 3, paused: 4 };
commonNode.EVENT_IDS = {
    0: 'update',
    1: 'completed',
    2: 'started',
    3: 'stopped',
    4: 'paused'
};
commonNode.EVENT_NAMES = {
    update: 'update',
    completed: 'complete',
    started: 'start',
    stopped: 'stop',
    paused: 'pause'
};

/**
 * Client request timeout. How long to wait before considering a request to a
 * tracker server to have timed out.
 */
commonNode.REQUEST_TIMEOUT = 15000;

/**
 * Client destroy timeout. How long to wait before forcibly cleaning up all
 * pending requests, open sockets, etc.
 */
commonNode.DESTROY_TIMEOUT = 1000;

function toUInt32 (n) {
    const buf = Buffer.allocUnsafe(4);
    buf.writeUInt32BE(n, 0);
    return buf
}
commonNode.toUInt32 = toUInt32;

/**
 * `querystring.parse` using `unescape` instead of decodeURIComponent, since bittorrent
 * clients send non-UTF8 querystrings
 * @param  {string} q
 * @return {Object}
 */
commonNode.querystringParse = q => querystring.parse(q, null, null, { decodeURIComponent: unescape });

/**
 * `querystring.stringify` using `escape` instead of encodeURIComponent, since bittorrent
 * clients send non-UTF8 querystrings
 * @param  {Object} obj
 * @return {string}
 */
commonNode.querystringStringify = obj => {
    let ret = querystring.stringify(obj, null, null, { encodeURIComponent: escape });
    ret = ret.replace(/[@*/+]/g, char => // `escape` doesn't encode the characters @*/+ so we do it manually
        `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    return ret
};

/**
 * Functions/constants needed by both the client and server.
 */

(function (exports) {
    exports.DEFAULT_ANNOUNCE_PEERS = 50;
    exports.MAX_ANNOUNCE_PEERS = 82;

    exports.binaryToHex = str => {
        if (typeof str !== 'string') {
            str = String(str);
        }
        return Buffer.from(str, 'binary').toString('hex')
    };

    exports.hexToBinary = str => {
        if (typeof str !== 'string') {
            str = String(str);
        }
        return Buffer.from(str, 'hex').toString('binary')
    };

    // HACK: Fix for WHATWG URL object not parsing non-standard URL schemes like
    // 'udp:'. Just replace it with 'http:' since we only need a few properties.
    //
    // Note: Only affects Chrome and Firefox. Works fine in Node.js, Safari, and
    // Edge.
    //
    // Note: UDP trackers aren't used in the normal browser build, but they are
    // used in a Chrome App build (i.e. by Brave Browser).
    //
    // Bug reports:
    // - Chrome: https://bugs.chromium.org/p/chromium/issues/detail?id=734880
    // - Firefox: https://bugzilla.mozilla.org/show_bug.cgi?id=1374505
    exports.parseUrl = str => {
        const url = new URL(str.replace(/^udp:/, 'http:'));

        if (str.match(/^udp:/)) {
            Object.defineProperties(url, {
                href: { value: url.href.replace(/^http/, 'udp') },
                protocol: { value: url.protocol.replace(/^http/, 'udp') },
                origin: { value: url.origin.replace(/^http/, 'udp') }
            });
        }

        return url
    };

    const config = commonNode;
    Object.assign(exports, config);
} (common$4));

const EventEmitter$1 = require$$0$1;

let Tracker$3 = class Tracker extends EventEmitter$1 {
    constructor (client, announceUrl) {
        super();

        this.client = client;
        this.announceUrl = announceUrl;

        this.interval = null;
        this.destroyed = false;
    }

    setInterval (intervalMs) {
        if (intervalMs == null) intervalMs = this.DEFAULT_ANNOUNCE_INTERVAL;

        clearInterval(this.interval);

        if (intervalMs) {
            this.interval = setInterval(() => {
                this.announce(this.client._defaultAnnounceOpts());
            }, intervalMs);
            if (this.interval.unref) this.interval.unref();
        }
    }
};

var tracker = Tracker$3;

const arrayRemove$1 = require$$0$2;
const bencode = require$$1;
const clone$2 = require$$2;
const compact2string$1 = require$$3;
const debug$3 = require$$4('bittorrent-tracker:http-tracker');
const get = require$$5;
const Socks$2 = require$$6;

const common$3 = common$4;
const Tracker$2 = tracker;

const HTTP_SCRAPE_SUPPORT = /\/(announce)[^/]*$/;

/**
 * HTTP torrent tracker client (for an individual tracker)
 *
 * @param {Client} client       parent bittorrent tracker client
 * @param {string} announceUrl  announce url of tracker
 * @param {Object} opts         options object
 */
let HTTPTracker$1 = class HTTPTracker extends Tracker$2 {
    constructor (client, announceUrl) {
        super(client, announceUrl);

        debug$3('new http tracker %s', announceUrl);

        // Determine scrape url (if http tracker supports it)
        this.scrapeUrl = null;

        const match = this.announceUrl.match(HTTP_SCRAPE_SUPPORT);
        if (match) {
            const pre = this.announceUrl.slice(0, match.index);
            const post = this.announceUrl.slice(match.index + 9);
            this.scrapeUrl = `${pre}/scrape${post}`;
        }

        this.cleanupFns = [];
        this.maybeDestroyCleanup = null;
    }

    announce (opts) {
        if (this.destroyed) return

        const params = Object.assign({}, opts, {
            compact: (opts.compact == null) ? 1 : opts.compact,
            info_hash: this.client._infoHashBinary,
            peer_id: this.client._peerIdBinary,
            port: this.client._port
        });
        if (this._trackerId) params.trackerid = this._trackerId;

        this._request(this.announceUrl, params, (err, data) => {
            if (err) return this.client.emit('warning', err)
            this._onAnnounceResponse(data);
        });
    }

    scrape (opts) {
        if (this.destroyed) return

        if (!this.scrapeUrl) {
            this.client.emit('error', new Error(`scrape not supported ${this.announceUrl}`));
            return
        }

        const infoHashes = (Array.isArray(opts.infoHash) && opts.infoHash.length > 0)
            ? opts.infoHash.map(infoHash => infoHash.toString('binary'))
            : (opts.infoHash && opts.infoHash.toString('binary')) || this.client._infoHashBinary;
        const params = {
            info_hash: infoHashes
        };
        this._request(this.scrapeUrl, params, (err, data) => {
            if (err) return this.client.emit('warning', err)
            this._onScrapeResponse(data);
        });
    }

    destroy (cb) {
        const self = this;
        if (this.destroyed) return cb(null)
        this.destroyed = true;
        clearInterval(this.interval);

        let timeout;

        // If there are no pending requests, destroy immediately.
        if (this.cleanupFns.length === 0) return destroyCleanup()

        // Otherwise, wait a short time for pending requests to complete, then force
        // destroy them.
        timeout = setTimeout(destroyCleanup, common$3.DESTROY_TIMEOUT);

        // But, if all pending requests complete before the timeout fires, do cleanup
        // right away.
        this.maybeDestroyCleanup = () => {
            if (this.cleanupFns.length === 0) destroyCleanup();
        };

        function destroyCleanup () {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            self.maybeDestroyCleanup = null;
            self.cleanupFns.slice(0).forEach(cleanup => {
                cleanup();
            });
            self.cleanupFns = [];
            cb(null);
        }
    }

    _request (requestUrl, params, cb) {
        const self = this;
        const parsedUrl = new URL(requestUrl + (requestUrl.indexOf('?') === -1 ? '?' : '&') + common$3.querystringStringify(params));
        let agent;
        if (this.client._proxyOpts) {
            agent = parsedUrl.protocol === 'https:' ? this.client._proxyOpts.httpsAgent : this.client._proxyOpts.httpAgent;
            if (!agent && this.client._proxyOpts.socksProxy) {
                agent = new Socks$2.Agent(clone$2(this.client._proxyOpts.socksProxy), (parsedUrl.protocol === 'https:'));
            }
        }

        this.cleanupFns.push(cleanup);

        let request = get.concat({
            url: parsedUrl.toString(),
            agent,
            timeout: common$3.REQUEST_TIMEOUT,
            headers: {
                'user-agent': this.client._userAgent || ''
            }
        }, onResponse);

        function cleanup () {
            if (request) {
                arrayRemove$1(self.cleanupFns, self.cleanupFns.indexOf(cleanup));
                request.abort();
                request = null;
            }
            if (self.maybeDestroyCleanup) self.maybeDestroyCleanup();
        }

        function onResponse (err, res, data) {
            cleanup();
            if (self.destroyed) return

            if (err) return cb(err)
            if (res.statusCode !== 200) {
                return cb(new Error(`Non-200 response code ${res.statusCode} from ${self.announceUrl}`))
            }
            if (!data || data.length === 0) {
                return cb(new Error(`Invalid tracker response from${self.announceUrl}`))
            }

            try {
                data = bencode.decode(data);
            } catch (err) {
                return cb(new Error(`Error decoding tracker response: ${err.message}`))
            }
            const failure = data['failure reason'];
            if (failure) {
                debug$3(`failure from ${requestUrl} (${failure})`);
                return cb(new Error(failure))
            }

            const warning = data['warning message'];
            if (warning) {
                debug$3(`warning from ${requestUrl} (${warning})`);
                self.client.emit('warning', new Error(warning));
            }

            debug$3(`response from ${requestUrl}`);

            cb(null, data);
        }
    }

    _onAnnounceResponse (data) {
        const interval = data.interval || data['min interval'];
        if (interval) this.setInterval(interval * 1000);

        const trackerId = data['tracker id'];
        if (trackerId) {
            // If absent, do not discard previous trackerId value
            this._trackerId = trackerId;
        }

        const response = Object.assign({}, data, {
            announce: this.announceUrl,
            infoHash: common$3.binaryToHex(data.info_hash)
        });
        this.client.emit('update', response);

        let addrs;
        if (Buffer.isBuffer(data.peers)) {
            // tracker returned compact response
            try {
                addrs = compact2string$1.multi(data.peers);
            } catch (err) {
                return this.client.emit('warning', err)
            }
            addrs.forEach(addr => {
                this.client.emit('peer', addr);
            });
        } else if (Array.isArray(data.peers)) {
            // tracker returned normal response
            data.peers.forEach(peer => {
                this.client.emit('peer', `${peer.ip}:${peer.port}`);
            });
        }

        if (Buffer.isBuffer(data.peers6)) {
            // tracker returned compact response
            try {
                addrs = compact2string$1.multi6(data.peers6);
            } catch (err) {
                return this.client.emit('warning', err)
            }
            addrs.forEach(addr => {
                this.client.emit('peer', addr);
            });
        } else if (Array.isArray(data.peers6)) {
            // tracker returned normal response
            data.peers6.forEach(peer => {
                const ip = /^\[/.test(peer.ip) || !/:/.test(peer.ip)
                    ? peer.ip /* ipv6 w/ brackets or domain name */
                    : `[${peer.ip}]`; /* ipv6 without brackets */
                this.client.emit('peer', `${ip}:${peer.port}`);
            });
        }
    }

    _onScrapeResponse (data) {
        // NOTE: the unofficial spec says to use the 'files' key, 'host' has been
        // seen in practice
        data = data.files || data.host || {};

        const keys = Object.keys(data);
        if (keys.length === 0) {
            this.client.emit('warning', new Error('invalid scrape response'));
            return
        }

        keys.forEach(infoHash => {
            // TODO: optionally handle data.flags.min_request_interval
            // (separate from announce interval)
            const response = Object.assign(data[infoHash], {
                announce: this.announceUrl,
                infoHash: common$3.binaryToHex(infoHash)
            });
            this.client.emit('scrape', response);
        });
    }
};

HTTPTracker$1.prototype.DEFAULT_ANNOUNCE_INTERVAL = 30 * 60 * 1000; // 30 minutes

var httpTracker = HTTPTracker$1;

const arrayRemove = require$$0$2;
const BN = require$$1$1;
const clone$1 = require$$2;
const compact2string = require$$3;
const debug$2 = require$$4('bittorrent-tracker:udp-tracker');
const dgram = require$$5$1;
const randombytes$1 = require$$6$1;
const Socks$1 = require$$6;

const common$2 = common$4;
const Tracker$1 = tracker;

/**
 * UDP torrent tracker client (for an individual tracker)
 *
 * @param {Client} client       parent bittorrent tracker client
 * @param {string} announceUrl  announce url of tracker
 * @param {Object} opts         options object
 */
let UDPTracker$1 = class UDPTracker extends Tracker$1 {
    constructor (client, announceUrl) {
        super(client, announceUrl);
        debug$2('new udp tracker %s', announceUrl);

        this.cleanupFns = [];
        this.maybeDestroyCleanup = null;
    }

    announce (opts) {
        if (this.destroyed) return
        this._request(opts);
    }

    scrape (opts) {
        if (this.destroyed) return
        opts._scrape = true;
        this._request(opts); // udp scrape uses same announce url
    }

    destroy (cb) {
        const self = this;
        if (this.destroyed) return cb(null)
        this.destroyed = true;
        clearInterval(this.interval);

        let timeout;

        // If there are no pending requests, destroy immediately.
        if (this.cleanupFns.length === 0) return destroyCleanup()

        // Otherwise, wait a short time for pending requests to complete, then force
        // destroy them.
        timeout = setTimeout(destroyCleanup, common$2.DESTROY_TIMEOUT);

        // But, if all pending requests complete before the timeout fires, do cleanup
        // right away.
        this.maybeDestroyCleanup = () => {
            if (this.cleanupFns.length === 0) destroyCleanup();
        };

        function destroyCleanup () {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            self.maybeDestroyCleanup = null;
            self.cleanupFns.slice(0).forEach(cleanup => {
                cleanup();
            });
            self.cleanupFns = [];
            cb(null);
        }
    }

    _request (opts) {
        const self = this;
        if (!opts) opts = {};

        let { hostname, port } = common$2.parseUrl(this.announceUrl);
        if (port === '') port = 80;

        let timeout;
        // Socket used to connect to the socks server to create a relay, null if socks is disabled
        let proxySocket;
        // Socket used to connect to the tracker or to the socks relay if socks is enabled
        let socket;
        // Contains the host/port of the socks relay
        let relay;

        let transactionId = genTransactionId();

        const proxyOpts = this.client._proxyOpts && clone$1(this.client._proxyOpts.socksProxy);
        if (proxyOpts) {
            if (!proxyOpts.proxy) proxyOpts.proxy = {};
            // UDP requests uses the associate command
            proxyOpts.proxy.command = 'associate';
            if (!proxyOpts.target) {
                // This should contain client IP and port but can be set to 0 if we don't have this information
                proxyOpts.target = {
                    host: '0.0.0.0',
                    port: 0
                };
            }

            if (proxyOpts.proxy.type === 5) {
                Socks$1.createConnection(proxyOpts, onGotConnection);
            } else {
                debug$2('Ignoring Socks proxy for UDP request because type 5 is required');
                onGotConnection(null);
            }
        } else {
            onGotConnection(null);
        }

        this.cleanupFns.push(cleanup);

        function onGotConnection (err, s, info) {
            if (err) return onError(err)

            proxySocket = s;
            socket = dgram.createSocket('udp4');
            relay = info;

            timeout = setTimeout(() => {
                // does not matter if `stopped` event arrives, so supress errors
                if (opts.event === 'stopped') cleanup();
                else onError(new Error(`tracker request timed out (${opts.event})`));
                timeout = null;
            }, common$2.REQUEST_TIMEOUT);
            if (timeout.unref) timeout.unref();

            send(Buffer.concat([
                common$2.CONNECTION_ID,
                common$2.toUInt32(common$2.ACTIONS.CONNECT),
                transactionId
            ]), relay);

            socket.once('error', onError);
            socket.on('message', onSocketMessage);
        }

        function cleanup () {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            if (socket) {
                arrayRemove(self.cleanupFns, self.cleanupFns.indexOf(cleanup));
                socket.removeListener('error', onError);
                socket.removeListener('message', onSocketMessage);
                socket.on('error', noop$1); // ignore all future errors
                try { socket.close(); } catch (err) {}
                socket = null;
                if (proxySocket) {
                    try { proxySocket.close(); } catch (err) {}
                    proxySocket = null;
                }
            }
            if (self.maybeDestroyCleanup) self.maybeDestroyCleanup();
        }

        function onError (err) {
            cleanup();
            if (self.destroyed) return

            try {
                // Error.message is readonly on some platforms.
                if (err.message) err.message += ` (${self.announceUrl})`;
            } catch (ignoredErr) {}
            // errors will often happen if a tracker is offline, so don't treat it as fatal
            self.client.emit('warning', err);
        }

        function onSocketMessage (msg) {
            if (proxySocket) msg = msg.slice(10);
            if (msg.length < 8 || msg.readUInt32BE(4) !== transactionId.readUInt32BE(0)) {
                return onError(new Error('tracker sent invalid transaction id'))
            }

            const action = msg.readUInt32BE(0);
            debug$2('UDP response %s, action %s', self.announceUrl, action);
            switch (action) {
                case 0: { // handshake
                    // Note: no check for `self.destroyed` so that pending messages to the
                    // tracker can still be sent/received even after destroy() is called

                    if (msg.length < 16) return onError(new Error('invalid udp handshake'))

                    if (opts._scrape) scrape(msg.slice(8, 16));
                    else announce(msg.slice(8, 16), opts);

                    break
                }
                case 1: { // announce
                    cleanup();
                    if (self.destroyed) return

                    if (msg.length < 20) return onError(new Error('invalid announce message'))

                    const interval = msg.readUInt32BE(8);
                    if (interval) self.setInterval(interval * 1000);

                    self.client.emit('update', {
                        announce: self.announceUrl,
                        complete: msg.readUInt32BE(16),
                        incomplete: msg.readUInt32BE(12)
                    });

                    let addrs;
                    try {
                        addrs = compact2string.multi(msg.slice(20));
                    } catch (err) {
                        return self.client.emit('warning', err)
                    }
                    addrs.forEach(addr => {
                        self.client.emit('peer', addr);
                    });

                    break
                }
                case 2: { // scrape
                    cleanup();
                    if (self.destroyed) return

                    if (msg.length < 20 || (msg.length - 8) % 12 !== 0) {
                        return onError(new Error('invalid scrape message'))
                    }
                    const infoHashes = (Array.isArray(opts.infoHash) && opts.infoHash.length > 0)
                        ? opts.infoHash.map(infoHash => infoHash.toString('hex'))
                        : [(opts.infoHash && opts.infoHash.toString('hex')) || self.client.infoHash];

                    for (let i = 0, len = (msg.length - 8) / 12; i < len; i += 1) {
                        self.client.emit('scrape', {
                            announce: self.announceUrl,
                            infoHash: infoHashes[i],
                            complete: msg.readUInt32BE(8 + (i * 12)),
                            downloaded: msg.readUInt32BE(12 + (i * 12)),
                            incomplete: msg.readUInt32BE(16 + (i * 12))
                        });
                    }

                    break
                }
                case 3: { // error
                    cleanup();
                    if (self.destroyed) return

                    if (msg.length < 8) return onError(new Error('invalid error message'))
                    self.client.emit('warning', new Error(msg.slice(8).toString()));

                    break
                }
                default:
                    onError(new Error('tracker sent invalid action'));
                    break
            }
        }

        function send (message, proxyInfo) {
            if (proxyInfo) {
                const pack = Socks$1.createUDPFrame({ host: hostname, port }, message);
                socket.send(pack, 0, pack.length, proxyInfo.port, proxyInfo.host);
            } else {
                socket.send(message, 0, message.length, port, hostname);
            }
        }

        function announce (connectionId, opts) {
            transactionId = genTransactionId();

            send(Buffer.concat([
                connectionId,
                common$2.toUInt32(common$2.ACTIONS.ANNOUNCE),
                transactionId,
                self.client._infoHashBuffer,
                self.client._peerIdBuffer,
                toUInt64(opts.downloaded),
                opts.left != null ? toUInt64(opts.left) : Buffer.from('FFFFFFFFFFFFFFFF', 'hex'),
                toUInt64(opts.uploaded),
                common$2.toUInt32(common$2.EVENTS[opts.event] || 0),
                common$2.toUInt32(0), // ip address (optional)
                common$2.toUInt32(0), // key (optional)
                common$2.toUInt32(opts.numwant),
                toUInt16(self.client._port)
            ]), relay);
        }

        function scrape (connectionId) {
            transactionId = genTransactionId();

            const infoHash = (Array.isArray(opts.infoHash) && opts.infoHash.length > 0)
                ? Buffer.concat(opts.infoHash)
                : (opts.infoHash || self.client._infoHashBuffer);

            send(Buffer.concat([
                connectionId,
                common$2.toUInt32(common$2.ACTIONS.SCRAPE),
                transactionId,
                infoHash
            ]), relay);
        }
    }
};

UDPTracker$1.prototype.DEFAULT_ANNOUNCE_INTERVAL = 30 * 60 * 1000; // 30 minutes

function genTransactionId () {
    return randombytes$1(4)
}

function toUInt16 (n) {
    const buf = Buffer.allocUnsafe(2);
    buf.writeUInt16BE(n, 0);
    return buf
}

const MAX_UINT = 4294967295;

function toUInt64 (n) {
    if (n > MAX_UINT || typeof n === 'string') {
        const bytes = new BN(n).toArray();
        while (bytes.length < 8) {
            bytes.unshift(0);
        }
        return Buffer.from(bytes)
    }
    return Buffer.concat([common$2.toUInt32(0), common$2.toUInt32(n)])
}

function noop$1 () {}

var udpTracker = UDPTracker$1;

const clone = require$$2;
const debug$1 = require$$4('bittorrent-tracker:websocket-tracker');
const Peer$1 = require$$2$1;
const randombytes = require$$6$1;
const Socket = require$$4$1;
const Socks = require$$6;

const common$1 = common$4;
const Tracker = tracker;

// Use a socket pool, so tracker clients share WebSocket objects for the same server.
// In practice, WebSockets are pretty slow to establish, so this gives a nice performance
// boost, and saves browser resources.
const socketPool = {};

const RECONNECT_MINIMUM = 10 * 1000;
const RECONNECT_MAXIMUM = 60 * 60 * 1000;
const RECONNECT_VARIANCE = 5 * 60 * 1000;
const OFFER_TIMEOUT = 50 * 1000;

let WebSocketTracker$1 = class WebSocketTracker extends Tracker {
    constructor (client, announceUrl) {
        super(client, announceUrl);
        debug$1('new websocket tracker %s', announceUrl);

        this.peers = {}; // peers (offer id -> peer)
        this.socket = null;

        this.reconnecting = false;
        this.retries = 0;
        this.reconnectTimer = null;

        // Simple boolean flag to track whether the socket has received data from
        // the websocket server since the last time socket.send() was called.
        this.expectingResponse = false;

        this._openSocket();
    }

    announce (opts) {
        if (this.destroyed || this.reconnecting) return
        if (!this.socket.connected) {
            this.socket.once('connect', () => {
                this.announce(opts);
            });
            return
        }

        const params = Object.assign({}, opts, {
            action: 'announce',
            info_hash: this.client._infoHashBinary,
            peer_id: this.client._peerIdBinary
        });
        if (this._trackerId) params.trackerid = this._trackerId;

        if (opts.event === 'stopped' || opts.event === 'completed') {
            // Don't include offers with 'stopped' or 'completed' event
            this._send(params);
        } else {
            // Limit the number of offers that are generated, since it can be slow
            const numwant = Math.min(opts.numwant, 5);

            this._generateOffers(numwant, offers => {
                params.numwant = numwant;
                params.offers = offers;
                this._send(params);
            });
        }
    }

    scrape (opts) {
        if (this.destroyed || this.reconnecting) return
        if (!this.socket.connected) {
            this.socket.once('connect', () => {
                this.scrape(opts);
            });
            return
        }

        const infoHashes = (Array.isArray(opts.infoHash) && opts.infoHash.length > 0)
            ? opts.infoHash.map(infoHash => infoHash.toString('binary'))
            : (opts.infoHash && opts.infoHash.toString('binary')) || this.client._infoHashBinary;
        const params = {
            action: 'scrape',
            info_hash: infoHashes
        };

        this._send(params);
    }

    destroy (cb = noop) {
        if (this.destroyed) return cb(null)

        this.destroyed = true;

        clearInterval(this.interval);
        clearTimeout(this.reconnectTimer);

        // Destroy peers
        for (const peerId in this.peers) {
            const peer = this.peers[peerId];
            clearTimeout(peer.trackerTimeout);
            peer.destroy();
        }
        this.peers = null;

        if (this.socket) {
            this.socket.removeListener('connect', this._onSocketConnectBound);
            this.socket.removeListener('data', this._onSocketDataBound);
            this.socket.removeListener('close', this._onSocketCloseBound);
            this.socket.removeListener('error', this._onSocketErrorBound);
            this.socket = null;
        }

        this._onSocketConnectBound = null;
        this._onSocketErrorBound = null;
        this._onSocketDataBound = null;
        this._onSocketCloseBound = null;

        if (socketPool[this.announceUrl]) {
            socketPool[this.announceUrl].consumers -= 1;
        }

        // Other instances are using the socket, so there's nothing left to do here
        if (socketPool[this.announceUrl].consumers > 0) return cb()

        let socket = socketPool[this.announceUrl];
        delete socketPool[this.announceUrl];
        socket.on('error', noop); // ignore all future errors
        socket.once('close', cb);

        let timeout;

        // If there is no data response expected, destroy immediately.
        if (!this.expectingResponse) return destroyCleanup()

        // Otherwise, wait a short time for potential responses to come in from the
        // server, then force close the socket.
        timeout = setTimeout(destroyCleanup, common$1.DESTROY_TIMEOUT);

        // But, if a response comes from the server before the timeout fires, do cleanup
        // right away.
        socket.once('data', destroyCleanup);

        function destroyCleanup () {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            socket.removeListener('data', destroyCleanup);
            socket.destroy();
            socket = null;
        }
    }

    _openSocket () {
        this.destroyed = false;

        if (!this.peers) this.peers = {};

        this._onSocketConnectBound = () => {
            this._onSocketConnect();
        };
        this._onSocketErrorBound = err => {
            this._onSocketError(err);
        };
        this._onSocketDataBound = data => {
            this._onSocketData(data);
        };
        this._onSocketCloseBound = () => {
            this._onSocketClose();
        };

        this.socket = socketPool[this.announceUrl];
        if (this.socket) {
            socketPool[this.announceUrl].consumers += 1;
            if (this.socket.connected) {
                this._onSocketConnectBound();
            }
        } else {
            const parsedUrl = new URL(this.announceUrl);
            let agent;
            if (this.client._proxyOpts) {
                agent = parsedUrl.protocol === 'wss:' ? this.client._proxyOpts.httpsAgent : this.client._proxyOpts.httpAgent;
                if (!agent && this.client._proxyOpts.socksProxy) {
                    agent = new Socks.Agent(clone(this.client._proxyOpts.socksProxy), (parsedUrl.protocol === 'wss:'));
                }
            }
            this.socket = socketPool[this.announceUrl] = new Socket({ url: this.announceUrl, agent });
            this.socket.consumers = 1;
            this.socket.once('connect', this._onSocketConnectBound);
        }

        this.socket.on('data', this._onSocketDataBound);
        this.socket.once('close', this._onSocketCloseBound);
        this.socket.once('error', this._onSocketErrorBound);
    }

    _onSocketConnect () {
        if (this.destroyed) return

        if (this.reconnecting) {
            this.reconnecting = false;
            this.retries = 0;
            this.announce(this.client._defaultAnnounceOpts());
        }
    }

    _onSocketData (data) {
        if (this.destroyed) return

        this.expectingResponse = false;

        try {
            data = JSON.parse(data);
        } catch (err) {
            this.client.emit('warning', new Error('Invalid tracker response'));
            return
        }

        if (data.action === 'announce') {
            this._onAnnounceResponse(data);
        } else if (data.action === 'scrape') {
            this._onScrapeResponse(data);
        } else {
            this._onSocketError(new Error(`invalid action in WS response: ${data.action}`));
        }
    }

    _onAnnounceResponse (data) {
        if (data.info_hash !== this.client._infoHashBinary) {
            debug$1(
                'ignoring websocket data from %s for %s (looking for %s: reused socket)',
                this.announceUrl, common$1.binaryToHex(data.info_hash), this.client.infoHash
            );
            return
        }

        if (data.peer_id && data.peer_id === this.client._peerIdBinary) {
            // ignore offers/answers from this client
            return
        }

        debug$1(
            'received %s from %s for %s',
            JSON.stringify(data), this.announceUrl, this.client.infoHash
        );

        const failure = data['failure reason'];
        if (failure) return this.client.emit('warning', new Error(failure))

        const warning = data['warning message'];
        if (warning) this.client.emit('warning', new Error(warning));

        const interval = data.interval || data['min interval'];
        if (interval) this.setInterval(interval * 1000);

        const trackerId = data['tracker id'];
        if (trackerId) {
            // If absent, do not discard previous trackerId value
            this._trackerId = trackerId;
        }

        if (data.complete != null) {
            const response = Object.assign({}, data, {
                announce: this.announceUrl,
                infoHash: common$1.binaryToHex(data.info_hash)
            });
            this.client.emit('update', response);
        }

        let peer;
        if (data.offer && data.peer_id) {
            debug$1('creating peer (from remote offer)');
            peer = this._createPeer();
            peer.id = common$1.binaryToHex(data.peer_id);
            peer.once('signal', answer => {
                const params = {
                    action: 'announce',
                    info_hash: this.client._infoHashBinary,
                    peer_id: this.client._peerIdBinary,
                    to_peer_id: data.peer_id,
                    answer,
                    offer_id: data.offer_id
                };
                if (this._trackerId) params.trackerid = this._trackerId;
                this._send(params);
            });
            this.client.emit('peer', peer);
            peer.signal(data.offer);
        }

        if (data.answer && data.peer_id) {
            const offerId = common$1.binaryToHex(data.offer_id);
            peer = this.peers[offerId];
            if (peer) {
                peer.id = common$1.binaryToHex(data.peer_id);
                this.client.emit('peer', peer);
                peer.signal(data.answer);

                clearTimeout(peer.trackerTimeout);
                peer.trackerTimeout = null;
                delete this.peers[offerId];
            } else {
                debug$1(`got unexpected answer: ${JSON.stringify(data.answer)}`);
            }
        }
    }

    _onScrapeResponse (data) {
        data = data.files || {};

        const keys = Object.keys(data);
        if (keys.length === 0) {
            this.client.emit('warning', new Error('invalid scrape response'));
            return
        }

        keys.forEach(infoHash => {
            // TODO: optionally handle data.flags.min_request_interval
            // (separate from announce interval)
            const response = Object.assign(data[infoHash], {
                announce: this.announceUrl,
                infoHash: common$1.binaryToHex(infoHash)
            });
            this.client.emit('scrape', response);
        });
    }

    _onSocketClose () {
        if (this.destroyed) return
        this.destroy();
        this._startReconnectTimer();
    }

    _onSocketError (err) {
        if (this.destroyed) return
        this.destroy();
        // errors will often happen if a tracker is offline, so don't treat it as fatal
        this.client.emit('warning', err);
        this._startReconnectTimer();
    }

    _startReconnectTimer () {
        const ms = Math.floor(Math.random() * RECONNECT_VARIANCE) + Math.min(Math.pow(2, this.retries) * RECONNECT_MINIMUM, RECONNECT_MAXIMUM);

        this.reconnecting = true;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.retries++;
            this._openSocket();
        }, ms);
        if (this.reconnectTimer.unref) this.reconnectTimer.unref();

        debug$1('reconnecting socket in %s ms', ms);
    }

    _send (params) {
        if (this.destroyed) return
        this.expectingResponse = true;
        const message = JSON.stringify(params);
        debug$1('send %s', message);
        this.socket.send(message);
    }

    _generateOffers (numwant, cb) {
        const self = this;
        const offers = [];
        debug$1('generating %s offers', numwant);

        for (let i = 0; i < numwant; ++i) {
            generateOffer();
        }
        checkDone();

        function generateOffer () {
            const offerId = randombytes(20).toString('hex');
            debug$1('creating peer (from _generateOffers)');
            const peer = self.peers[offerId] = self._createPeer({ initiator: true });
            peer.once('signal', offer => {
                offers.push({
                    offer,
                    offer_id: common$1.hexToBinary(offerId)
                });
                checkDone();
            });
            peer.trackerTimeout = setTimeout(() => {
                debug$1('tracker timeout: destroying peer');
                peer.trackerTimeout = null;
                delete self.peers[offerId];
                peer.destroy();
            }, OFFER_TIMEOUT);
            if (peer.trackerTimeout.unref) peer.trackerTimeout.unref();
        }

        function checkDone () {
            if (offers.length === numwant) {
                debug$1('generated %s offers', numwant);
                cb(offers);
            }
        }
    }

    _createPeer (opts) {
        const self = this;

        opts = Object.assign({
            trickle: false,
            config: self.client._rtcConfig,
            wrtc: self.client._wrtc
        }, opts);

        const peer = new Peer$1(opts);

        peer.once('error', onError);
        peer.once('connect', onConnect);

        return peer

        // Handle peer 'error' events that are fired *before* the peer is emitted in
        // a 'peer' event.
        function onError (err) {
            self.client.emit('warning', new Error(`Connection error: ${err.message}`));
            peer.destroy();
        }

        // Once the peer is emitted in a 'peer' event, then it's the consumer's
        // responsibility to listen for errors, so the listeners are removed here.
        function onConnect () {
            peer.removeListener('error', onError);
            peer.removeListener('connect', onConnect);
        }
    }
};

WebSocketTracker$1.prototype.DEFAULT_ANNOUNCE_INTERVAL = 30 * 1000; // 30 seconds
// Normally this shouldn't be accessed but is occasionally useful
WebSocketTracker$1._socketPool = socketPool;

function noop () {}

var websocketTracker = WebSocketTracker$1;

const debug = require$$4('bittorrent-tracker:client');
const EventEmitter = require$$0$1;
const once = require$$2$2;
const parallel = require$$3$1;
const Peer = require$$2$1;
const queueMicrotask = require$$5$2;

const common = common$4;
const HTTPTracker = httpTracker; // empty object in browser
const UDPTracker = udpTracker; // empty object in browser
const WebSocketTracker = websocketTracker;

/**
 * BitTorrent tracker client.
 *
 * Find torrent peers, to help a torrent client participate in a torrent swarm.
 *
 * @param {Object} opts                          options object
 * @param {string|Buffer} opts.infoHash          torrent info hash
 * @param {string|Buffer} opts.peerId            peer id
 * @param {string|Array.<string>} opts.announce  announce
 * @param {number} opts.port                     torrent client listening port
 * @param {function} opts.getAnnounceOpts        callback to provide data to tracker
 * @param {number} opts.rtcConfig                RTCPeerConnection configuration object
 * @param {number} opts.userAgent                User-Agent header for http requests
 * @param {number} opts.wrtc                     custom webrtc impl (useful in node.js)
 * @param {object} opts.proxyOpts                proxy options (useful in node.js)
 */
class Client extends EventEmitter {
    constructor (opts = {}) {
        super();

        if (!opts.peerId) throw new Error('Option `peerId` is required')
        if (!opts.infoHash) throw new Error('Option `infoHash` is required')
        if (!opts.announce) throw new Error('Option `announce` is required')
        if (!process.browser && !opts.port) throw new Error('Option `port` is required')

        this.peerId = typeof opts.peerId === 'string'
            ? opts.peerId
            : opts.peerId.toString('hex');
        this._peerIdBuffer = Buffer.from(this.peerId, 'hex');
        this._peerIdBinary = this._peerIdBuffer.toString('binary');

        this.infoHash = typeof opts.infoHash === 'string'
            ? opts.infoHash.toLowerCase()
            : opts.infoHash.toString('hex');
        this._infoHashBuffer = Buffer.from(this.infoHash, 'hex');
        this._infoHashBinary = this._infoHashBuffer.toString('binary');

        debug('new client %s', this.infoHash);

        this.destroyed = false;

        this._port = opts.port;
        this._getAnnounceOpts = opts.getAnnounceOpts;
        this._rtcConfig = opts.rtcConfig;
        this._userAgent = opts.userAgent;
        this._proxyOpts = opts.proxyOpts;

        // Support lazy 'wrtc' module initialization
        // See: https://github.com/webtorrent/webtorrent-hybrid/issues/46
        this._wrtc = typeof opts.wrtc === 'function' ? opts.wrtc() : opts.wrtc;

        let announce = typeof opts.announce === 'string'
            ? [opts.announce]
            : opts.announce == null ? [] : opts.announce;

        // Remove trailing slash from trackers to catch duplicates
        announce = announce.map(announceUrl => {
            announceUrl = announceUrl.toString();
            if (announceUrl[announceUrl.length - 1] === '/') {
                announceUrl = announceUrl.substring(0, announceUrl.length - 1);
            }
            return announceUrl
        });
        // remove duplicates by converting to Set and back
        announce = Array.from(new Set(announce));

        const webrtcSupport = this._wrtc !== false && (!!this._wrtc || Peer.WEBRTC_SUPPORT);

        const nextTickWarn = err => {
            queueMicrotask(() => {
                this.emit('warning', err);
            });
        };

        this._trackers = announce
            .map(announceUrl => {
                let parsedUrl;
                try {
                    parsedUrl = common.parseUrl(announceUrl);
                } catch (err) {
                    nextTickWarn(new Error(`Invalid tracker URL: ${announceUrl}`));
                    return null
                }

                const port = parsedUrl.port;
                if (port < 0 || port > 65535) {
                    nextTickWarn(new Error(`Invalid tracker port: ${announceUrl}`));
                    return null
                }

                const protocol = parsedUrl.protocol;
                if ((protocol === 'http:' || protocol === 'https:') &&
                    typeof HTTPTracker === 'function') {
                    return new HTTPTracker(this, announceUrl)
                } else if (protocol === 'udp:' && typeof UDPTracker === 'function') {
                    return new UDPTracker(this, announceUrl)
                } else if ((protocol === 'ws:' || protocol === 'wss:') && webrtcSupport) {
                    // Skip ws:// trackers on https:// sites because they throw SecurityError
                    if (protocol === 'ws:' && typeof window !== 'undefined' &&
                        window.location.protocol === 'https:') {
                        nextTickWarn(new Error(`Unsupported tracker protocol: ${announceUrl}`));
                        return null
                    }
                    return new WebSocketTracker(this, announceUrl)
                } else {
                    nextTickWarn(new Error(`Unsupported tracker protocol: ${announceUrl}`));
                    return null
                }
            })
            .filter(Boolean);
    }

    /**
     * Send a `start` announce to the trackers.
     * @param {Object} opts
     * @param {number=} opts.uploaded
     * @param {number=} opts.downloaded
     * @param {number=} opts.left (if not set, calculated automatically)
     */
    start (opts) {
        opts = this._defaultAnnounceOpts(opts);
        opts.event = 'started';
        debug('send `start` %o', opts);
        this._announce(opts);

        // start announcing on intervals
        this._trackers.forEach(tracker => {
            tracker.setInterval();
        });
    }

    /**
     * Send a `stop` announce to the trackers.
     * @param {Object} opts
     * @param {number=} opts.uploaded
     * @param {number=} opts.downloaded
     * @param {number=} opts.numwant
     * @param {number=} opts.left (if not set, calculated automatically)
     */
    stop (opts) {
        opts = this._defaultAnnounceOpts(opts);
        opts.event = 'stopped';
        debug('send `stop` %o', opts);
        this._announce(opts);
    }

    /**
     * Send a `complete` announce to the trackers.
     * @param {Object} opts
     * @param {number=} opts.uploaded
     * @param {number=} opts.downloaded
     * @param {number=} opts.numwant
     * @param {number=} opts.left (if not set, calculated automatically)
     */
    complete (opts) {
        if (!opts) opts = {};
        opts = this._defaultAnnounceOpts(opts);
        opts.event = 'completed';
        debug('send `complete` %o', opts);
        this._announce(opts);
    }

    /**
     * Send a `update` announce to the trackers.
     * @param {Object} opts
     * @param {number=} opts.uploaded
     * @param {number=} opts.downloaded
     * @param {number=} opts.numwant
     * @param {number=} opts.left (if not set, calculated automatically)
     */
    update (opts) {
        opts = this._defaultAnnounceOpts(opts);
        if (opts.event) delete opts.event;
        debug('send `update` %o', opts);
        this._announce(opts);
    }

    _announce (opts) {
        this._trackers.forEach(tracker => {
            // tracker should not modify `opts` object, it's passed to all trackers
            tracker.announce(opts);
        });
    }

    /**
     * Send a scrape request to the trackers.
     * @param {Object} opts
     */
    scrape (opts) {
        debug('send `scrape`');
        if (!opts) opts = {};
        this._trackers.forEach(tracker => {
            // tracker should not modify `opts` object, it's passed to all trackers
            tracker.scrape(opts);
        });
    }

    setInterval (intervalMs) {
        debug('setInterval %d', intervalMs);
        this._trackers.forEach(tracker => {
            tracker.setInterval(intervalMs);
        });
    }

    destroy (cb) {
        if (this.destroyed) return
        this.destroyed = true;
        debug('destroy');

        const tasks = this._trackers.map(tracker => cb => {
            tracker.destroy(cb);
        });

        parallel(tasks, cb);

        this._trackers = [];
        this._getAnnounceOpts = null;
    }

    _defaultAnnounceOpts (opts = {}) {
        if (opts.numwant == null) opts.numwant = common.DEFAULT_ANNOUNCE_PEERS;

        if (opts.uploaded == null) opts.uploaded = 0;
        if (opts.downloaded == null) opts.downloaded = 0;

        if (this._getAnnounceOpts) opts = Object.assign({}, opts, this._getAnnounceOpts());

        return opts
    }
}

/**
 * Simple convenience function to scrape a tracker for an info hash without needing to
 * create a Client, pass it a parsed torrent, etc. Support scraping a tracker for multiple
 * torrents at the same time.
 * @params {Object} opts
 * @param  {string|Array.<string>} opts.infoHash
 * @param  {string} opts.announce
 * @param  {function} cb
 */
Client.scrape = (opts, cb) => {
    cb = once(cb);

    if (!opts.infoHash) throw new Error('Option `infoHash` is required')
    if (!opts.announce) throw new Error('Option `announce` is required')

    const clientOpts = Object.assign({}, opts, {
        infoHash: Array.isArray(opts.infoHash) ? opts.infoHash[0] : opts.infoHash,
        peerId: Buffer.from('01234567890123456789'), // dummy value
        port: 6881 // dummy value
    });

    const client = new Client(clientOpts);
    client.once('error', cb);
    client.once('warning', cb);

    let len = Array.isArray(opts.infoHash) ? opts.infoHash.length : 1;
    const results = {};
    client.on('scrape', data => {
        len -= 1;
        results[data.infoHash] = data;
        if (len === 0) {
            client.destroy();
            const keys = Object.keys(results);
            if (keys.length === 1) {
                cb(null, results[keys[0]]);
            } else {
                cb(null, results);
            }
        }
    });

    opts.infoHash = Array.isArray(opts.infoHash)
        ? opts.infoHash.map(infoHash => Buffer.from(infoHash, 'hex'))
        : Buffer.from(opts.infoHash, 'hex');
    client.scrape({ infoHash: opts.infoHash });
    return client
};

var client = Client;

var client$1 = /*@__PURE__*/getDefaultExportFromCjs(client);

export { client$1 as default };
