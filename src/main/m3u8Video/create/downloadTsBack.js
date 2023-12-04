import {splitArray} from '../../util/array';
import fs from "fs";
import Throttle from "../../util/source/throttle";
import childProcess from "child_process";
import {deleteDirectory} from "../../util/fs";
import {parentPort} from 'worker_threads';
import axios from '../../util/source/axios'
import os from "os";
import path from "path";
import { batchNum } from "./m3u8Config";

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
    parentPort.postMessage({
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
    }
    if(data.type === 'pause') {
        loadingRecord.pause = true
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
    const convert = await downloadTss(loadingRecord.totalUrls, m3u8Data, tempPath, loadingRecord.totalIndex, loadingRecord)
    if (convert && convert !== 'pause') {
        combineVideo(tempPath, outputPath, loadingRecord)
    }
}

/**
 * 下载Ts文件
 * @returns {Promise<void>}
 */
async function downloadTss(totalUrls, m3u8Data, tempPath, totalIndex, loadingRecord) {
    let m3u8DataString = await loopDownloadTs(totalUrls, m3u8Data, tempPath, totalIndex, loadingRecord)
    if(m3u8DataString !== 'pause') {
        let reloadNumber = 0
        while(loadingRecord.missLinks.length > 0 && reloadNumber < 50 && loadingRecord.pause === false) {
            reloadNumber ++
            m3u8DataString = await checkErrorTs(m3u8DataString, loadingRecord, reloadNumber, tempPath)
        }
        if(loadingRecord.pause) {
            loadingRecord.batchIndex = totalIndex
            parentPort.postMessage({
                type: 'updateRecord',
                key: 'batchIndex',
                value: loadingRecord.batchIndex
            })
            parentPort.postMessage({
                type: 'pauseSuccess'
            })
            return 'pause'
        } else {
            loadingRecord.isStart = false
            parentPort.postMessage({
                type: 'updateRecord',
                key: 'isStart',
                value: false
            })
            if(loadingRecord.missLinks.length > 0) {
                loadingRecord.message = {
                    status: 'error',
                    content: `下载失败，请重新进行下载!`
                }
                parentPort.postMessage({
                    type: 'updateRecord',
                    key: 'message',
                    value: loadingRecord.message
                })
                return null
            }
            return m3u8Data
        }
    } else {
        return 'pause'
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
async function loopDownloadTs(totalUrls, m3u8Data, tempPath, totalIndex, loadingRecord) {
    const newErrors = loadingRecord.missLinks || []
    // 检索出没有完成的Urls 再进行下载。
    // to do
    const twoUrls = splitArray(totalUrls, batchNum)
    function download(index) {
        if (index < totalIndex && loadingRecord.pause === false) {
            const pros = twoUrls[index]
            const promises = pros.map(async (urlItem) => {
                return getFileAndStore(urlItem, tempPath, newErrors, loadingRecord)
            })
            return Promise.all(promises)
                .then(async (results) => {
                    index = index + 1
                    return download(index)
                })
        } else if(loadingRecord.pause) {
            loadingRecord.batchIndex = index
            parentPort.postMessage({
                type: 'updateRecord',
                key: 'batchIndex',
                value: loadingRecord.batchIndex
            })
            loadingRecord.missLinks = newErrors
            parentPort.postMessage({
                type: 'updateRecord',
                key: 'missLinks',
                value: loadingRecord.missLinks
            })
            parentPort.postMessage({ type: 'pauseSuccess'})
            return 'pause'
        } else {
            loadingRecord.missLinks = newErrors
            parentPort.postMessage({
                type: 'updateRecord',
                key: 'missLinks',
                value: loadingRecord.missLinks
            })
            return replaceTsFileUrls(totalUrls, m3u8Data, tempPath)
        }
    }
    return download(loadingRecord.batchIndex || 0)
}

/**
 * 检测是否有错误ts下载，再次请求
 * @returns {Promise<void>}
 */
function checkErrorTs(data, loadingRecord, reloadNumber, tempPath) {
    console.log('出现了请求失败了')
    console.log(loadingRecord.missLinks)
    console.log(`对失败的进行第${reloadNumber}次请求`)
    const newErrors = []
    const promises = loadingRecord.missLinks.map(async (urlItem) => {
        return getFileAndStore(urlItem, tempPath, newErrors, loadingRecord)
    })
    return Promise.all(promises)
        .then(() => {
            let m3u8Data = data
            loadingRecord.missLinks.forEach((item, index) => {
                m3u8Data = m3u8Data.replace(item.item, path.resolve(tempPath, `${item.number}.ts`))
            })
            fs.writeFile(path.resolve(tempPath, `index.m3u8`), m3u8Data, "utf-8", (err) => {
                if(err) {
                    console.log('checkErrorTs failure')
                }
            })
            loadingRecord.missLinks = newErrors
            parentPort.postMessage({
                type: 'updateRecord',
                key: 'missLinks',
                value: loadingRecord.missLinks
            })
            return m3u8Data
        })
}

async function getFileAndStore(urlItem, tempPath, errorList, loadingRecord) {
    const headers = {
        "Content-Type": "application/octet-stream",
    }
    if(urlItem.cookie) {
        headers.Cookie = urlItem.cookie
    }
    return axios.get(urlItem.url, {
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
        loadingRecord.successTsNum ++
        parentPort.postMessage({
            type: 'updateRecord',
            key: 'successTsNum',
            value: loadingRecord.successTsNum
        })
        sendProcess(loadingRecord)
        return 'success'
    }).catch((e) => {
        errorList.push({
            number: urlItem.number,
            url: urlItem.url,
            item: urlItem.item,
            cookie: urlItem.cookie
        })
        return 'failure'
    })
}

function replaceTsFileUrls(urls, data, tempPath) {
    let m3u8Data = data
    urls.forEach((item) => {
        m3u8Data = m3u8Data.replace(item.item, path.resolve(tempPath, `${item.number}.ts`))
    })
    fs.writeFile(path.resolve(tempPath, `index.m3u8`), m3u8Data, "utf-8", (err) => {
        if(err) {
            console.log('replaceTsFileUrls failure')
        } else {
            console.log('replaceTsFileUrls success')
        }
    })
    return m3u8Data
}

/**
 * 合并，并生成视频
 */
function combineVideo(tempPath, outputPath, loadingRecord) {
    loadingRecord.pause = true
    parentPort.postMessage({
        type: 'updateRecord',
        key: 'pause',
        value: true
    })
    loadingRecord.message = {
        status: 'success',
        content: `合成中...`
    }
    parentPort.postMessage({
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
    // exec_1.stdout.on('data', (info) => {
    //     console.log('stdout:' + info)
    // });
    exec_1.stderr.on('data', (info) => {
        console.log('2222222：' + info)
    });
    exec_1.stderr.on('close', async () => {
        deleteTempSource(tempPath)
        parentPort.postMessage({
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
