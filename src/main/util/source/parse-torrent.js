import require$$0 from 'bencode';
import require$$1 from 'blob-to-buffer';
import require$$2 from 'fs';
import require$$3 from 'simple-get';
import require$$4 from 'magnet-uri';
import require$$5 from 'path';
import require$$6 from './simple-sha1';
import require$$7 from 'queue-microtask';

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var src = {exports: {}};

/*! parse-torrent. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */

/* global Blob */

const bencode = require$$0;
const blobToBuffer = require$$1;
const fs = require$$2; // browser exclude
const get = require$$3;
const magnet = require$$4;
const path = require$$5;
const sha1 = require$$6;
const queueMicrotask = require$$7;

src.exports = parseTorrent;
var remote = src.exports.remote = parseTorrentRemote;

var toMagnetURI = src.exports.toMagnetURI = magnet.encode;
var toTorrentFile = src.exports.toTorrentFile = encodeTorrentFile;

/**
 * Parse a torrent identifier (magnet uri, .torrent file, info hash)
 * @param  {string|Buffer|Object} torrentId
 * @return {Object}
 */
function parseTorrent (torrentId) {
    if (typeof torrentId === 'string' && /^(stream-)?magnet:/.test(torrentId)) {
        // if magnet uri (string)
        const torrentObj = magnet(torrentId);

        // infoHash won't be defined if a non-bittorrent magnet is passed
        if (!torrentObj.infoHash) {
            throw new Error('Invalid torrent identifier')
        }

        return torrentObj
    } else if (typeof torrentId === 'string' && (/^[a-f0-9]{40}$/i.test(torrentId) || /^[a-z2-7]{32}$/i.test(torrentId))) {
        // if info hash (hex/base-32 string)
        return magnet(`magnet:?xt=urn:btih:${torrentId}`)
    } else if (Buffer.isBuffer(torrentId) && torrentId.length === 20) {
        // if info hash (buffer)
        return magnet(`magnet:?xt=urn:btih:${torrentId.toString('hex')}`)
    } else if (Buffer.isBuffer(torrentId)) {
        // if .torrent file (buffer)
        return decodeTorrentFile(torrentId) // might throw
    } else if (torrentId && torrentId.infoHash) {
        // if parsed torrent (from `parse-torrent` or `magnet-uri`)
        torrentId.infoHash = torrentId.infoHash.toLowerCase();

        if (!torrentId.announce) torrentId.announce = [];

        if (typeof torrentId.announce === 'string') {
            torrentId.announce = [torrentId.announce];
        }

        if (!torrentId.urlList) torrentId.urlList = [];

        return torrentId
    } else {
        throw new Error('Invalid torrent identifier')
    }
}

function parseTorrentRemote (torrentId, opts, cb) {
    if (typeof opts === 'function') return parseTorrentRemote(torrentId, {}, opts)
    if (typeof cb !== 'function') throw new Error('second argument must be a Function')

    let parsedTorrent;
    try {
        parsedTorrent = parseTorrent(torrentId);
    } catch (err) {
        // If torrent fails to parse, it could be a Blob, http/https URL or
        // filesystem path, so don't consider it an error yet.
    }

    if (parsedTorrent && parsedTorrent.infoHash) {
        queueMicrotask(() => {
            cb(null, parsedTorrent);
        });
    } else if (isBlob(torrentId)) {
        blobToBuffer(torrentId, (err, torrentBuf) => {
            if (err) return cb(new Error(`Error converting Blob: ${err.message}`))
            parseOrThrow(torrentBuf);
        });
    } else if (typeof get === 'function' && /^https?:/.test(torrentId)) {
        // http, or https url to torrent file
        opts = Object.assign({
            url: torrentId,
            timeout: 30 * 1000,
            headers: { 'user-agent': 'WebTorrent (https://webtorrent.io)' }
        }, opts);
        get.concat(opts, (err, res, torrentBuf) => {
            if (err) return cb(new Error(`Error downloading torrent: ${err.message}`))
            parseOrThrow(torrentBuf);
        });
    } else if (typeof fs.readFile === 'function' && typeof torrentId === 'string') {
        // assume it's a filesystem path
        fs.readFile(torrentId, (err, torrentBuf) => {
            if (err) return cb(new Error('Invalid torrent identifier'))
            parseOrThrow(torrentBuf);
        });
    } else {
        queueMicrotask(() => {
            cb(new Error('Invalid torrent identifier'));
        });
    }

    function parseOrThrow (torrentBuf) {
        try {
            parsedTorrent = parseTorrent(torrentBuf);
        } catch (err) {
            return cb(err)
        }
        if (parsedTorrent && parsedTorrent.infoHash) cb(null, parsedTorrent);
        else cb(new Error('Invalid torrent identifier'));
    }
}

/**
 * Parse a torrent. Throws an exception if the torrent is missing required fields.
 * @param  {Buffer|Object} torrent
 * @return {Object}        parsed torrent
 */
function decodeTorrentFile (torrent) {
    if (Buffer.isBuffer(torrent)) {
        torrent = bencode.decode(torrent);
    }

    // sanity check
    ensure(torrent.info, 'info');
    ensure(torrent.info['name.utf-8'] || torrent.info.name, 'info.name');
    ensure(torrent.info['piece length'], 'info[\'piece length\']');
    ensure(torrent.info.pieces, 'info.pieces');

    if (torrent.info.files) {
        torrent.info.files.forEach(file => {
            ensure(typeof file.length === 'number', 'info.files[0].length');
            ensure(file['path.utf-8'] || file.path, 'info.files[0].path');
        });
    } else {
        ensure(typeof torrent.info.length === 'number', 'info.length');
    }

    const result = {
        info: torrent.info,
        infoBuffer: bencode.encode(torrent.info),
        name: (torrent.info['name.utf-8'] || torrent.info.name).toString(),
        announce: []
    };

    result.infoHash = sha1.sync(result.infoBuffer);
    result.infoHashBuffer = Buffer.from(result.infoHash, 'hex');

    if (torrent.info.private !== undefined) result.private = !!torrent.info.private;

    if (torrent['creation date']) result.created = new Date(torrent['creation date'] * 1000);
    if (torrent['created by']) result.createdBy = torrent['created by'].toString();

    if (Buffer.isBuffer(torrent.comment)) result.comment = torrent.comment.toString();

    // announce and announce-list will be missing if metadata fetched via ut_metadata
    if (Array.isArray(torrent['announce-list']) && torrent['announce-list'].length > 0) {
        torrent['announce-list'].forEach(urls => {
            urls.forEach(url => {
                result.announce.push(url.toString());
            });
        });
    } else if (torrent.announce) {
        result.announce.push(torrent.announce.toString());
    }

    // handle url-list (BEP19 / web seeding)
    if (Buffer.isBuffer(torrent['url-list'])) {
        // some clients set url-list to empty string
        torrent['url-list'] = torrent['url-list'].length > 0
            ? [torrent['url-list']]
            : [];
    }
    result.urlList = (torrent['url-list'] || []).map(url => url.toString());

    // remove duplicates by converting to Set and back
    result.announce = Array.from(new Set(result.announce));
    result.urlList = Array.from(new Set(result.urlList));

    const files = torrent.info.files || [torrent.info];
    result.files = files.map((file, i) => {
        const parts = [].concat(result.name, file['path.utf-8'] || file.path || []).map(p => p.toString());
        return {
            path: path.join.apply(null, [path.sep].concat(parts)).slice(1),
            name: parts[parts.length - 1],
            length: file.length,
            offset: files.slice(0, i).reduce(sumLength, 0)
        }
    });

    result.length = files.reduce(sumLength, 0);

    const lastFile = result.files[result.files.length - 1];

    result.pieceLength = torrent.info['piece length'];
    result.lastPieceLength = ((lastFile.offset + lastFile.length) % result.pieceLength) || result.pieceLength;
    result.pieces = splitPieces(torrent.info.pieces);

    return result
}

/**
 * Convert a parsed torrent object back into a .torrent file buffer.
 * @param  {Object} parsed parsed torrent
 * @return {Buffer}
 */
function encodeTorrentFile (parsed) {
    const torrent = {
        info: parsed.info
    };

    torrent['announce-list'] = (parsed.announce || []).map(url => {
        if (!torrent.announce) torrent.announce = url;
        url = Buffer.from(url, 'utf8');
        return [url]
    });

    torrent['url-list'] = parsed.urlList || [];

    if (parsed.private !== undefined) {
        torrent.private = Number(parsed.private);
    }

    if (parsed.created) {
        torrent['creation date'] = (parsed.created.getTime() / 1000) | 0;
    }

    if (parsed.createdBy) {
        torrent['created by'] = parsed.createdBy;
    }

    if (parsed.comment) {
        torrent.comment = parsed.comment;
    }

    return bencode.encode(torrent)
}

/**
 * Check if `obj` is a W3C `Blob` or `File` object
 * @param  {*} obj
 * @return {boolean}
 */
function isBlob (obj) {
    return typeof Blob !== 'undefined' && obj instanceof Blob
}

function sumLength (sum, file) {
    return sum + file.length
}

function splitPieces (buf) {
    const pieces = [];
    for (let i = 0; i < buf.length; i += 20) {
        pieces.push(buf.slice(i, i + 20).toString('hex'));
    }
    return pieces
}

function ensure (bool, fieldName) {
    if (!bool) throw new Error(`Torrent is missing required field: ${fieldName}`)
}
(() => { Buffer.alloc(0); })();

var srcExports = src.exports;
var index = /*@__PURE__*/getDefaultExportFromCjs(srcExports);

export { index as default, remote, toMagnetURI, toTorrentFile };
