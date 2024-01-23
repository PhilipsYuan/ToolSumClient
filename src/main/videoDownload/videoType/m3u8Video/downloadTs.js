import {splitArray} from '../../../util/array';
import fs from "fs";
import Throttle from "../../../util/source/throttle";
import childProcess from "child_process";
import {deleteDirectory} from "../../../util/fs";
import {parentPort} from 'worker_threads';
import axios from '../../../util/source/axios'
import os from "os";
import path from "path";
import { batchNum } from "./m3u8Config";
import { getHeaders } from "../../../util/httpHeaders";

const CancelToken = axios.CancelToken
const source = CancelToken.source()
const binary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const ffmpegPath = path.resolve(__dirname, binary);
let tempSourcePath = null
let loadingRecord = null


/**
 * 发送下载进度
 */
const sendProcess = Throttle((loadingRecord) => {
    loadingRecord.message = {
        status: 'success',
        content: `下载完成${Number((loadingRecord.successTsNum / loadingRecord.totalUrls.length) * 100).toFixed(2)}%`
    }
    parentPort && parentPort.postMessage({
        type: 'updateRecord',
        key: 'message',
        value: loadingRecord.message
    })
}, 1000)

/**
 * 唤起下载
 * @param event
 * @returns {Promise<void>}
 */
parentPort.onmessage = async (event) => {
    const data = event.data
    if(data.type === 'start') {
        tempSourcePath = data.tempSourcePath
        loadingRecord = data.loadingRecord
        await downloadingM3u8Video(data.loadingRecord)

    } else if(data.type === 'pause') {
        const notLoadUrls = loadingRecord.totalUrls.filter((urlItem) => urlItem.isLoad)
        if(notLoadUrls.length > 0) {
            loadingRecord.pause = true
            // 取消发出去请求
            source.cancel("pause")
            // 更新进度条内容
            updateProcessPercent(loadingRecord, notLoadUrls.length)
            // 更新外部的totalUrls外部的状态
            parentPort && parentPort.postMessage({
                type: 'updateRecord',
                key: 'totalUrls',
                value: loadingRecord.totalUrls
            })
            // 通知外部暂停成功
            parentPort && parentPort.postMessage({
                type: 'pauseSuccess'
            })
        }
    }
}

/**
 * 视频下载
 * @returns {Promise<void>}
 */
async function downloadingM3u8Video(loadingRecord) {
    const tempPath = path.resolve(tempSourcePath, loadingRecord.name);
    const outputPath = loadingRecord.outputPath;
    let m3u8Data = loadingRecord.m3u8Data
    const convert = await downloadTss(loadingRecord.totalUrls, m3u8Data, tempPath, loadingRecord)
    if (convert && !loadingRecord.pause) {
        combineVideo(tempPath, outputPath, loadingRecord)
    }
}

/**
 * 下载Ts文件
 * @returns {Promise<void>}
 */
async function downloadTss(totalUrls, m3u8Data, tempPath, loadingRecord) {
    let reloadNumber = 0
    let m3u8DataString = m3u8Data
    while (reloadNumber < 50 && loadingRecord.pause === false) {
        const notLoadUrls = totalUrls.filter((urlItem) => !urlItem.isLoad)
        if(notLoadUrls.length > 0) {
            reloadNumber++
            m3u8DataString = await loopDownloadTs(notLoadUrls, m3u8DataString, tempPath, loadingRecord);
        } else {
            break;
        }
    }
    if(loadingRecord.pause) {
        return null
    } else if (totalUrls.filter((urlItem) => !urlItem.isLoad).length > 0) {
        // 更新外面的字段信息
        loadingRecord.isStart = false
        parentPort && parentPort.postMessage({
            type: 'updateRecord',
            key: 'isStart',
            value: false
        })
        loadingRecord.message = {
            status: 'error',
            content: `下载失败，请重新进行下载!`
        }
        parentPort && parentPort.postMessage({
            type: 'updateRecord',
            key: 'message',
            value: loadingRecord.message
        })
        return null
    } else {
        await replaceTsFileUrls(totalUrls, m3u8Data, tempPath)
        return 'success'
    }
}

/**
 * 顺序下载Ts文件
 * urlItem : {
 *     url: 访问请求ts全路径,
 *     number 存储本地m3u8文件时，本地ts文件的文件名,
 *     item: m3u8里的url地址（可能是全路径，也可能是部分路径),
 *     isLoad: 是否已经加载过了，暂时时使用。用来计算successTsNum，从而统计加载的百分比。
 *     cookie: 请求时，是否携带cookie
 * }
 */
async function loopDownloadTs(notLoadUrls, m3u8Data, tempPath, loadingRecord) {
    const twoUrls = splitArray(notLoadUrls, batchNum)
    function download(index) {
        if (index < twoUrls.length && loadingRecord.pause === false) {
            const pros = twoUrls[index]
            const promises = pros.map(async (urlItem) => {
                return getFileAndStore(urlItem, tempPath, loadingRecord)
            })
            return Promise.all(promises)
                .then(async (results) => {
                    index = index + 1
                    return download(index)
                })
        }
    }
    return download( 0)
}

async function getFileAndStore(urlItem, tempPath, loadingRecord) {
    const headers = getHeaders(urlItem.url)
    const {url: perfectUrl, range} = convertPerfectUrl(urlItem.url)
    headers["Content-Type"] = "application/octet-stream"
    if(range) {
        headers["Accept-Ranges"] = 'bytes';
        headers["Range"] = `bytes=${range}`;
    }
    if(urlItem.cookie) {
        headers.Cookie = urlItem.cookie
    }
    return axios.get(perfectUrl, {
        cancelToken: source.token,
        timeout: 10000,
        responseType: "arraybuffer",
        headers: headers
    }).then(async (res) => {
        let data = res.data
        let fileType = 'ts'
         fs.writeFile(path.resolve(tempPath, `${urlItem.number}.${fileType}`), data, 'binary', (err) => {
            if(err) {
                console.log('ts file create failure')
            }
        })
        urlItem.isLoad = true
        updateProcessPercent(loadingRecord, loadingRecord.successTsNum + 1)
        return 'success'
    }).catch((e) => {
        urlItem.isLoad = false
        return 'failure'
    })
}

function replaceTsFileUrls(urls, data, tempPath) {
    let m3u8Data = data
    urls.forEach((item) => {
        m3u8Data = m3u8Data.replace(item.item, path.resolve(tempPath, `${item.number}.ts`))
    })
    return new Promise((resolve) => {
        fs.writeFile(path.resolve(tempPath, `index.m3u8`), m3u8Data, "utf-8", (err) => {
            if(err) {
                console.log('replaceTsFileUrls failure')
            } else {
                resolve(m3u8Data)
                console.log('replaceTsFileUrls success')
            }
        })
    })
}

/**
 * 合并，并生成视频
 */
function combineVideo(tempPath, outputPath, loadingRecord) {
    loadingRecord.pause = true
    parentPort && parentPort.postMessage({
        type: 'updateRecord',
        key: 'pause',
        value: true
    })
    loadingRecord.message = {
        status: 'success',
        content: `合成中...`
    }
    parentPort && parentPort.postMessage({
        type: 'updateRecord',
        key: 'message',
        value: loadingRecord.message
    })
    const m3u8FilePath = path.resolve(tempPath, 'index.m3u8')
    console.log(`${ffmpegPath} -allowed_extensions ALL -protocol_whitelist "file,http,crypto,tcp,https,tls" -i "${m3u8FilePath}" -progress - -c copy "${outputPath}"`)
    const exec_1 = childProcess.spawn(`${ffmpegPath} -allowed_extensions ALL -protocol_whitelist "file,http,crypto,tcp,https,tls" -i "${m3u8FilePath}" -progress - -c copy "${outputPath}"`, {
        maxBuffer: 5 * 1024 * 1024,
        shell: true
    });
    exec_1.stderr.on('data', (info) => {
        console.log('2222222：' + info)
    });
    exec_1.stderr.on('close', async () => {
        deleteTempSource(tempPath)
        parentPort && parentPort.postMessage({
            type: 'combineSuccess'
        })
    });
}

/**
 * 删除临时文件
 */
function deleteTempSource(tempPath) {
    deleteDirectory(tempPath)
}

/**
 * 更新进度条
 */
function updateProcessPercent(loadingRecord, num) {
    loadingRecord.successTsNum = num
    parentPort && parentPort.postMessage({
        type: 'updateRecord',
        key: 'successTsNum',
        value: loadingRecord.successTsNum
    })
    sendProcess(loadingRecord)
}

/**
 * 矫正Url
 */
function convertPerfectUrl(url) {
    if(/&mediaRange=/.test(url)) {
        const match = url.match(/&mediaRange=(\d+and\d+)/)
        const matchString = match[0]
        const range = match[1].replace('and', '-')
        const perfectUrl = url.replace(matchString, '')
        return { url: perfectUrl, range}
    } else {
        return {url}
    }
}
