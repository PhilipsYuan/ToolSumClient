import {app, ipcMain} from "electron";
import fs from "fs";
import {getSecretKeys, getCorrectM3u8File, getPlayList} from "../../util/m3u8Parse"
import {deleteDirectory, makeDir} from "../../util/fs"
import {downloadTss} from './downloadTs';
import {sendTips} from '../../util/electronOperations';
import {newFinishedRecord} from '../finishList/finishList';
import childProcess from 'child_process';
import {splitArray} from '../../util/array';
import {newLoadingRecord, deleteLoadingRecordAndFile} from '../processList/processList';

const ffmpegPath = __dirname + '/darwin-x64/ffmpeg';
const axios = require('axios');
const basePath = app.getPath('userData');
const tempSourcePath = `${basePath}/m3u8Video/tempSource`;

ipcMain.handle('check-output-file-not-exist', checkOutputFileNotExist);
ipcMain.handle('create-m3u8-download-task', createM3u8DownloadTask);

/**
 * 创建m3u8下载任务
 */
async function createM3u8DownloadTask(event, url, name, outPath) {
    const outputPath = `${outPath}/${name}.mp4`
    if (checkOutputFileNotExist(null, outputPath)) {
        const tempPath = `${tempSourcePath}/${name}`
        makeDir(tempPath)
        return getCorrectM3u8File(url)
            .then(async (data) => {
                if (data) {
                    const urlObject = new URL(url);
                    const host = `${urlObject.protocol}//${urlObject.host}`
                    const m3u8Data = await downloadSecretKey(data, host, tempPath, urlObject.pathname)
                    const urls = getPlayList(data)
                    const formatUrls = urls.map((item, index) => {
                        let url = ''
                        if (item[0] !== '/' && !/^http/.test(item)) {
                            url = host + urlObject.pathname.match(/\/.*\//)[0] + item
                        } else if (/^http/.test(item)) {
                            url = item
                        } else {
                            url = host + item
                        }
                        return {
                            item, url, number: index + 1
                        }
                    })
                    const twoUrls = splitArray(formatUrls, 100)
                    await newLoadingRecord({
                        name: name,
                        m3u8Url: url,
                        m3u8Data: m3u8Data,
                        batchIndex: 0,
                        totalIndex: twoUrls.length,
                        totalUrls: formatUrls,
                        outputPath: outputPath
                    })
                    return 'success'
                } else {
                    return 'failure'
                }
            })
    }
}

/**
 * 启动视频开始下载
 * @returns {Promise<void>}
 */
export async function startDownloadVideo(loadingRecord) {
    loadingRecord.isStart = true
    loadingRecord.message = {
        status: 'success',
        content: `开始下载中...`
    }
    const tempPath = `${tempSourcePath}/${loadingRecord.name}`;
    const outputPath = loadingRecord.outputPath;
    let m3u8Data = loadingRecord.m3u8Data
    const convert = await downloadTss(loadingRecord.totalUrls, m3u8Data, tempPath, loadingRecord.totalIndex, loadingRecord)
    if (convert && convert !== 'pause') {
        combineVideo(tempPath, outputPath, loadingRecord)
    }
}

/**
 * 继续下载内容
 * @returns {Promise<void>}
 */
export async function continueDownload(loadingRecord) {
    const outputPath = loadingRecord.outputPath;
    let m3u8Data = loadingRecord.m3u8Data;
    const tempPath = `${tempSourcePath}/${loadingRecord.name}`;
    const convert = await downloadTss(loadingRecord.totalUrls, m3u8Data, tempPath, loadingRecord.totalIndex, loadingRecord)
    if (convert && convert !== 'pause') {
        testSpawnCombine(tempPath, outputPath, loadingRecord)
    }
}

/**
 * 下载解码key，并进行替换,
 * 文件里可能会出现多个
 */
async function downloadSecretKey(data, host, tempPath, pathname) {
    const keys = getSecretKeys(data)
    let i = 0;
    let m3u8Data = data
    if (keys.length > 0) {
        while (i < keys.length) {
            let url = null
            if (keys[i][0] !== '/' && !/^http/.test(keys[i])) {
                url = host + pathname.match(/\/.*\//)[0] + keys[i]
            } else if (/^http/.test(keys[i])) {
                url = keys[i]
            } else {
                url = host + keys[i]
            }
            const res = await axios.get(url, {
                responseType: "arraybuffer",
                headers: {
                    "Content-Type": "application/octet-stream",
                }
            })
            const dyData = new Uint8Array(res.data);
            await fs.writeFileSync(`${tempPath}/key${i + 1}.key`, dyData, "utf-8")
            i++
        }
        keys.forEach((item, index) => {
            m3u8Data = m3u8Data.replace(item, `./key${index + 1}.key`)
        })
        await fs.writeFileSync(`${tempPath}/index.m3u8`, m3u8Data, "utf-8")
    }
    return m3u8Data
}

/**
 * 合并，并生成视频
 */
function combineVideo(tempPath, outputPath, loadingRecord) {
    loadingRecord.pause = true
    loadingRecord.message = {
        status: 'success',
        content: `合成中...`
    }
    const exec_1 = childProcess.spawn(`cd "${tempPath}" && ${ffmpegPath} -allowed_extensions ALL -protocol_whitelist "file,http,crypto,tcp,https,tls" -i "index.m3u8" -progress - -c copy "${outputPath}"`, {
        maxBuffer: 5 * 1024 * 1024,
        shell: true
    });
    // exec_1.stdout.on('data', (info) => {
    //     console.log('stdout:' + info)
    // });
    exec_1.stderr.on('data', (info) => {
        console.log('2222222：' + info)
    });
    exec_1.stderr.on('close', async () => {
        deleteTempSource(tempPath)
        await newFinishedRecord({
            name: loadingRecord.name,
            filePath: outputPath,
            m3u8Url: loadingRecord.m3u8Url
        })
        await deleteLoadingRecordAndFile(null, loadingRecord.id)
        sendTips('m3u8-download-video-success', loadingRecord.id)

    });
}

/**
 * 检测要输出的文件是否已经存在，如果已经存在，提示更换名称
 */
function checkOutputFileNotExist(event, path) {
    const isExist = fs.existsSync(path)
    if (isExist) {
        return false
    } else {
        return true
    }
}

/**
 * 删除临时文件
 */
function deleteTempSource(tempPath) {
    deleteDirectory(tempPath)
}