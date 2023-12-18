import Discovery from '../../../util/source/torrent-discovery';
import Protocol from '../../../util/source/bittorrent-protocol';
import ut_metadata from '../../../util/source/ut_metadata';
import addrToIPPort from 'addr-to-ip-port';
import net from 'net';


export class TorrentDownloader {
    constructor(port, trackers, timeout) {
        this.SELF_HASH = '4290a5ff50130a90f1de64b1d9cc7822799affd5';
        this.port = port | 6881;
        this.trackers = trackers;
        this.timeout = timeout | 80000;
    }

    downloadTorrent(infoHash) {
        let self = this;
        return new Promise((resolve, reject) => {
            let dis = new Discovery({infoHash: infoHash, peerId: this.SELF_HASH, port: this.port, dht: true, announce: this.trackers})
                .on('peer', function (peer) {
                    const peerAddress = {address: addrToIPPort(peer)[0], port: addrToIPPort(peer)[1]};
                    self.getMetadata(peerAddress, infoHash, resolve);
                    // console.log(peer)
                });
            setTimeout(() => {
                dis.destroy();
                reject(new Error("Torrent Timeout"))
            }, this.timeout)
        })
    }

    getMetadata(peerAddress, infoHash, resolve) {
        const socket = new net.Socket();
        socket.setTimeout(this.timeout);
        socket.connect(peerAddress.port, peerAddress.address, () => {
            const wire = new Protocol();

            socket.pipe(wire).pipe(socket);
            wire.use(ut_metadata());
            wire.handshake(infoHash, this.SELF_HASH, {dht: true});
            wire.on('handshake', function (infoHash, peerId) {
                wire.ut_metadata.fetch();
            });
            wire.ut_metadata.on('metadata', function (rawMetadata) {
                resolve(rawMetadata);
                wire.destroy();
                socket.destroy()
            })
        });
        socket.on('error', err => {
            socket.destroy();
        });
    }
}


// const download = new TorrentDownloader()
// download.downloadTorrent('760E2BD0150873AAE61055F946C6419616148436')
//     .then((res) => {
//         console.log(res)
//         x
//     })