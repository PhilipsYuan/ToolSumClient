// import WebTorrent from 'webtorrent'
import {ipcMain} from "electron";
import WebTorrent from '../../../util/source/webtorrent'
import {newLoadingRecord} from "../../processList/processList";

export async function createMagnetDownloadTask(event, url, name, outPath) {
    await newLoadingRecord({
        type: 'magnet',
        name: name,
        m3u8Url: url,
        outputPath: outPath
    })
    return 'success'
}

function createMagnetDownloadTaskDemo() {
    console.log('here')
    const client = new WebTorrent()
    const torrentId = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent'
    // 启动下载任务
    client.add(torrentId, { path: './downloads' }, function (torrent) {
        console.log('Downloading:', torrent.infoHash)

        // 监听下载进度事件
        torrent.on('download', function (bytes) {
            const progress = Math.round(torrent.progress * 100 * 100) / 100;
            console.log(`Progress: ${progress}%`)
            console.log(`Download speed: ${bytes} bytes/sec`)
        })

        // 下载完成事件处理函数
        torrent.on('done', function () {
            console.log('Download completed')

            // 关闭客户端连接（可选）
            client.destroy()
        })
    })
}