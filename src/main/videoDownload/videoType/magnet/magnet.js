import WebTorrent from '../../../util/source/webtorrent'
import {deleteLoadingRecordAndFile, newLoadingRecord} from "../../processList/processList";
import {newFinishedRecord} from "../../finishList/finishList";
import {sendTips} from "../../../util/source/electronOperations";

export async function createMagnetDownloadTask(event, url, name, outPath) {
    await newLoadingRecord({
        type: 'magnet',
        name: name,
        m3u8Url: url,
        outputPath: outPath
    })
    return 'success'
}

export function startDownloadMagnetVideo(item) {
    const client = new WebTorrent()
    client.add(item.m3u8Url, { path: item.outputPath }, function (torrent) {
        // 监听下载进度事件
        torrent.on('download', function (bytes) {
            const progress = Math.round(torrent.progress * 100 * 100) / 100;
            console.log(`Progress: ${progress}%`)
            console.log(`Download speed: ${bytes} bytes/sec`)
            item.message = {
                status: 'success',
                content: `下载完成${progress}%`
            }
        })

        // 下载完成事件处理函数
        torrent.on('done', async function () {
            console.log('Download completed')
            // 关闭客户端连接（可选）
            client.destroy()
            await newFinishedRecord({
                type: 'magnet',
                name: item.name,
                filePath: item.outputPath,
                m3u8Url: item.m3u8Url
            })
            await deleteLoadingRecordAndFile(null, item.id, 'success')
            sendTips('m3u8-download-video-success', item.id)
        })
    })
}