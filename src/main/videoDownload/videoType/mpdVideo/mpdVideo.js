import path from "path";
import shortId from "shortid";
import {newLoadingRecord} from "../../processList/processList";
import {makeDir} from "../../../util/fs";
import {app} from "electron";
const basePath = app.getPath('userData');
const tempSourcePath = path.resolve(basePath, 'm3u8Video', 'tempSource')
makeDir(tempSourcePath)
export async function createMpdVideoDownloadTask(event, url, name, outPath, audioUrl) {
    const outputPath = path.resolve(outPath, `${name}.mp4`);
    const id = shortId.generate()
    const json = {
        id: id,
        type: 'biliTV',
        name: name,
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
    await newLoadingRecord(json)
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
    if(item.lastAudioDownloadPosition === 0 || item.lastAudioDownloadPosition < item.totalAudioLength) {
        promises.push(downloadBFile('audio', cancelTokens.audioCancelToken, item, item.audioUrl, audioPath))
    }
    Promise.all(promises)
        .then(() => {
            combineVideo(tempPath, videoPath, audioPath, item)
        })
}
