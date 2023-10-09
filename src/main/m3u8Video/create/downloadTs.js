import {splitArray} from '../../util/array';
import fs from "fs";
import Throttle from "../../util/throttle";
import childProcess from "child_process";
import {deleteDirectory} from "../../util/fs";
import {parentPort} from 'worker_threads'

const axios = require('axios')
const ffmpegPath = __dirname + '/darwin-x64/ffmpeg';
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
    const tempPath = `${tempSourcePath}/${loadingRecord.name}`;
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
        while(loadingRecord.missLinks.length > 0 && reloadNumber < 100 && loadingRecord.pause === false) {
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
 */
async function loopDownloadTs(totalUrls, m3u8Data, tempPath, totalIndex, loadingRecord) {
    const newErrors = loadingRecord.missLinks || []
    const twoUrls = splitArray(totalUrls, 100)
    function download(index) {
        if (index < totalIndex && loadingRecord.pause === false) {
            const pros = twoUrls[index]
            const promises = pros.map(async (item) => {
                return getFileAndStore(item.url, item.number, item.item, tempPath, newErrors, loadingRecord)
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
    const promises = loadingRecord.missLinks.map(async (item) => {
        return getFileAndStore(item.url, item.number, item.item, tempPath, newErrors, loadingRecord)
    })
    return Promise.all(promises)
        .then(() => {
            let m3u8Data = data
            loadingRecord.missLinks.forEach((item, index) => {
                m3u8Data = m3u8Data.replace(item.item, `./${item.number}.ts`)
            })
            fs.writeFile(`${tempPath}/index.m3u8`, m3u8Data, "utf-8", (err) => {
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

async function getFileAndStore(url, number, item, tempPath, errorList, loadingRecord) {
    return axios.get(url, {
        timeout: 10000,
        responseType: "arraybuffer",
        headers: {
            "Content-Type": "application/octet-stream",
        }
    }).then(async (res) => {
         fs.writeFile(`${tempPath}/${number}.ts`, res.data, 'binary', (err) => {
            if(err) {
                console.log('ts file create failure')
            }
        })
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
            number: number,
            url: url,
            item: item
        })
        return 'failure'
    })
}

function replaceTsFileUrls(urls, data, tempPath) {
    let m3u8Data = data
    urls.forEach((item) => {
        m3u8Data = m3u8Data.replace(item.item, `./${item.number}.ts`)
    })
    fs.writeFile(`${tempPath}/index.m3u8`, m3u8Data, "utf-8", (err) => {
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