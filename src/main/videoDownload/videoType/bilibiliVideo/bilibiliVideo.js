import path from "path";
import shortId from "shortid";
import {deleteLoadingRecordAndFile, newLoadingRecord} from "../../processList/processList";
import axios from '../../../util/source/axios'
import {app} from "electron";
import os from "os";
import childProcess from "child_process";
import {deleteDirectory, makeDir} from "../../../util/fs";
import {newFinishedRecord} from "../../finishList/finishList";
import {sendTips} from "../../../util/electronOperations";
import fs from 'fs'
import {m3u8VideoDownloadingListDB} from "../../../db/db";
import dayjs from "dayjs";

const binary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const ffmpegPath = path.resolve(__dirname, binary);
const basePath = app.getPath('userData');
const tempSourcePath = path.resolve(basePath, 'm3u8Video', 'tempSource')
makeDir(tempSourcePath)
const cancelTokenList = {}

export async function createBiliVideoDownloadTask(event, url, name, outPath, htmlUrl, audioUrl,  isUpdate, loadingId) {
    const outputPath = path.resolve(outPath, `${name}.mp4`);
    if(isUpdate) {
        const data = {
            name: name,
            htmlUrl: htmlUrl,
            m3u8Url: url,
            audioUrl: audioUrl,
            outputPath: outputPath
        }
        return UpdateLoadingRecord(data, loadingId)
    } else {
        const id = shortId.generate()
        const json = {
            id: id,
            type: getType(url),
            name: name,
            htmlUrl: htmlUrl || '',
            m3u8Url: url,
            audioUrl: audioUrl,
            message: {
                status: 'success',
                content: '未开始进行下载'
            },
            // 判断是否在进行中
            pausing: false,
            pause: false,
            isStart: false,
            totalVideoLength: 0,
            totalAudioLength: 0,
            lastVideoDownloadPosition: 0,
            lastAudioDownloadPosition: 0,
            outputPath: outputPath,
            updateDate: dayjs().format("YYYY/MM/DD HH:mm")
        }
        await newLoadingRecord(json)
        return 'success'
    }
}

async function UpdateLoadingRecord (data, id) {
    const list = m3u8VideoDownloadingListDB.data.loadingList
    const item = list.find((item) => item.id === id)
    item.m3u8Url = data.m3u8Url
    item.htmlUrl = data.htmlUrl
    item.name = data.name
    item.audioUrl = data.audioUrl
    item.outputPath = data.outputPath
    item.totalVideoLength = 0
    item.totalAudioLength = 0
    item.lastVideoDownloadPosition = 0
    item.lastAudioDownloadPosition = 0
    item.updateDate = dayjs().format("YYYY/MM/DD HH:mm")
    item.message = {
        status: 'success',
        content: '未开始进行下载'
    }
    await m3u8VideoDownloadingListDB.write()
    return 'success'
}

/**
 * 开始进行下载
 * @param item
 */
export function startDownloadBiliVideo(item) {
    const tempPath = path.resolve(tempSourcePath, item.name);
    makeDir(tempPath)
    const videoPath = path.resolve(tempPath, item.name + '-video.m4s')
    const audioPath = path.resolve(tempPath, item.name + '-audio.m4s')
    const cancelTokens = createCancelTokens(item)
    const promises = []
    if(item.lastVideoDownloadPosition === 0 || item.lastVideoDownloadPosition < item.totalVideoLength) {
        promises.push(downloadBFile('video', cancelTokens.videoCancelToken, item, item.m3u8Url, videoPath))
    }
    if(item.audioUrl != 'noNeed') {
        if(item.lastAudioDownloadPosition === 0 || item.lastAudioDownloadPosition < item.totalAudioLength) {
            promises.push(downloadBFile('audio', cancelTokens.audioCancelToken, item, item.audioUrl, audioPath))
        }
    }
    Promise.all(promises)
        .then(() => {
            combineVideo(tempPath, videoPath, audioPath, item)
        })
}

/**
 * 暂停下载视频
 * @returns {Promise<void>}
 */
export async function pauseBiliTVDownloadVideo(item) {
    item.pause = true
    const cancelTokens = cancelTokenList[item.id]
    cancelTokens.videoCancelToken.cancel('pause')
    cancelTokens.audioCancelToken.cancel('pause')
    delete cancelTokenList[item.id]
    setTimeout(async () => {
        await m3u8VideoDownloadingListDB.write()
    }, 100)

}

/**
 * 继续进行下载
 * @returns {Promise<void>}
 */
export async function continueBiliTVDownloadVideo(item) {
    startDownloadBiliVideo(item)
}

function combineVideo(tempPath, videoPath, audioPath, item) {
    let command = `${ffmpegPath} -y -i "${videoPath}" -i "${audioPath}" -c copy "${item.outputPath}"`
    if(item.audioUrl === 'noNeed') {
        command = `${ffmpegPath} -y -i "${videoPath}" -c copy "${item.outputPath}"`
    }
    const exec = childProcess.spawn(command, {
        maxBuffer: 5 * 1024 * 1024,
        shell: true
    });
    exec.stderr.on('data', (info) => {
        console.log('2222222：' + info)
    });
    exec.stderr.on('close', async () => {
        deleteDirectory(tempPath)
        await newFinishedRecord({
            name: item.name,
            filePath: item.outputPath,
            m3u8Url: item.m3u8Url,
            audioUrl: item.audioUrl
        })
        await deleteLoadingRecordAndFile(null, item.id, 'success')
        sendTips('m3u8-download-video-success', item.id)
    });
}

/**
 * 下载文件（video 和 audio）
 * type: video, audio
 * @param type
 * @param url
 * @param fullFileName
 * @param progressCallback
 * @returns {*}
 */
function downloadBFile(type, cancelToken, item, url, fullFileName, progressCallback) {
    const baseVideoPosition = item.lastVideoDownloadPosition > 0 ? item.lastVideoDownloadPosition : 0;
    const baseAudioPosition = item.lastAudioDownloadPosition > 0 ? item.lastAudioDownloadPosition : 0;
    return axios
        .get(url, {
            cancelToken: cancelToken.token,
            responseType: 'stream',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                referer: getRefer(url),
                'Range': `bytes=${type === 'video' ? item.lastVideoDownloadPosition : item.lastAudioDownloadPosition}-`
            },
            onDownloadProgress: (progressEvent) => {
                if(type === 'video') {
                    if(item.lastVideoDownloadPosition === 0) {
                        item.totalVideoLength = progressEvent.total;
                    }
                    item.lastVideoDownloadPosition = baseVideoPosition + progressEvent.loaded
                    item.message = {
                        status: 'success',
                        content: `下载完成${Number((item.lastVideoDownloadPosition / item.totalVideoLength) * 100).toFixed(2)}%`
                    }
                } else {
                    if(item.lastAudioDownloadPosition === 0) {
                        item.totalAudioLength = progressEvent.total;
                    }
                    item.lastAudioDownloadPosition = baseAudioPosition + progressEvent.loaded
                }
            }
        })
        .then(({ data, headers }) => {
            const isExist = fs.existsSync(fullFileName)
            const option = {
                flags: isExist ? 'a' : 'w',
                start: type === 'video' ? baseVideoPosition : baseAudioPosition
            }
            return new Promise((resolve, reject) => {
                data.pipe(
                    fs.createWriteStream(fullFileName, option).on('finish', () => {
                        resolve({
                            fullFileName
                        });
                    }),
                );
            });
        });
}

function createCancelTokens (item) {
    const CancelToken = axios.CancelToken;
    const videoCancelToken = CancelToken.source();
    const audioCancelToken = CancelToken.source();
    cancelTokenList[item.id] = {
        videoCancelToken,
        audioCancelToken
    }
    return {
        videoCancelToken,
        audioCancelToken
    }
}

function getType(url) {
    if(/bilivideo/.test(url)) {
        return 'biliTV'
    } else if(/bdstatic/.test(url)) {
        return 'haokan'
    } else {
        return 'V&A'
    }
}
function getRefer(url) {
    if(/bilivideo/.test(url)) {
        return 'https://www.bilibili.com'
    } else if(/bdstatic/.test(url)) {
        return 'https://haokan.baidu.com/'
    } else if(/ixigua\.com/.test(url)) {
        return 'https://www.ixigua.com/'
    } else  {
        return ''
    }
}