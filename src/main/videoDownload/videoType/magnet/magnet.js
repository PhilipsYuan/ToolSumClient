import WebTorrent from '../../../util/source/webtorrent'
import {deleteLoadingRecordAndFile, newLoadingRecord} from "../../processList/processList";
import {newFinishedRecord} from "../../finishList/finishList";
import {sendTips} from "../../../util/electronOperations";
import path from "path";
import {deleteDirectory, makeDir} from "../../../util/fs";
import {m3u8VideoDownloadingListDB} from "../../../db/db";
import shortId from "shortid";
import {app} from "electron";
import { TorrentDownloader } from './TorrentDownloader'
import fs from 'fs'
import parseTorrent from '../../../util/source/parse-torrent'
const client = new WebTorrent()
const torrentList = {}
const basePath = app.getPath('userData');
const tempTorrentPath = path.resolve(basePath, 'm3u8Video', 'tempTorrent')
makeDir(tempTorrentPath)

export async function createMagnetDownloadTask(event, url, name, htmlUrl, outPath) {
    const outputPath = path.resolve(outPath, name);
    const id = shortId.generate()
    const json = {
        id: id,
        type: 'magnet',
        name: name,
        htmlUrl: htmlUrl || '',
        m3u8Url: url,
        message: {
            status: 'success',
            content: '未开始进行下载'
        },
        // 判断是否在进行中
        pausing: false,
        pause: false,
        isStart: false,
        outputPath: outputPath
    }
    const torrentPath = await createTorrentFile(url)
    json.torrentPath = torrentPath
    await newLoadingRecord(json)
    return 'success'
}

async function createTorrentFile(magnetUrl) {
    const magInfo = parseTorrent(magnetUrl)
    const infoHash = magInfo.infoHash.toUpperCase()
    const torrentDownloader = new TorrentDownloader()
    const torrentInfo = await torrentDownloader.downloadTorrent(infoHash)
    const torrentPath = path.resolve(tempTorrentPath, `${infoHash}.torrent`)
    fs.writeFileSync(torrentPath, torrentInfo)
    return torrentPath
}

/**
 * 开始进行下载
 * @param item
 */
export function startDownloadMagnetVideo(item) {
    addTorrent(item)
}

/**
 * 删除magnet的下载一半的内容
 * 如果是，暂停一半时，进行删除，需要删除下载一半的文件
 * 如果是完成删除时，则不需要删除文件
 * @param item
 */
export function deleteMagnetLoadingRecordAndFile(item, callType) {
    if(callType === 'delete') {
        deleteDirectory(item.outputPath)
    }
}

/**
 * 暂停下载视频
 * @returns {Promise<void>}
 */
export async function pauseMagnetDownloadVideo(item) {
    const torrent = torrentList[item.id]
    if(torrent) {
        item.pause = true
        client.remove(torrentList[item.id])
        delete torrentList[item.id]
    }
    await m3u8VideoDownloadingListDB.write()
}

/**
 * 继续进行下载
 * @returns {Promise<void>}
 */
export async function continueMagnetDownloadVideo(item) {
    addTorrent(item)
}

/**
 * 增加torrent下载
 */
function addTorrent(item) {
    client.add(item.torrentPath, { path: item.outputPath }, function (torrent) {
        console.log('3333')
        torrentList[item.id] = torrent
        console.log(torrent.name)
        torrent.files.forEach(function (file) {
            console.log(file.name)
        })
        // 监听下载进度事件
        torrent.on('download', function (bytes) {
            const progress = Math.round(torrent.progress * 100 * 100) / 100;
            item.message = {
                status: 'success',
                content: `下载完成${progress}%`
            }
        })
        // 下载完成事件处理函数
        torrent.on('done', async function () {
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
    client.on('torrent', function (torrent) {
        console.log('here')
    })
    client.on('error', function (err) {
        console.log(err)
    })
}

function createMagnetDownloadTaskDemo() {
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