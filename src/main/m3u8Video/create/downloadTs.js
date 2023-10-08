import {splitArray} from '../../util/array';
import fs from "fs";
import Throttle from "../../util/throttle";
import {deleteLoadingRecordAndFile, savePauseDownloadInfo} from "../processList/processList";
import childProcess from "child_process";
import {newFinishedRecord} from "../finishList/finishList";
import {sendTips} from "../../util/electronOperations";
import {deleteDirectory} from "../../util/fs";
import {app} from "electron";
const axios = require('axios')
const ffmpegPath = __dirname + '/darwin-x64/ffmpeg';
const basePath = app.getPath('userData');
const tempSourcePath = `${basePath}/m3u8Video/tempSource`;

/**
 * 视频下载
 * @returns {Promise<void>}
 */
export async function downloadingM3u8Video(loadingRecord) {
    const tempPath = `${tempSourcePath}/${loadingRecord.name}`;
    const outputPath = loadingRecord.outputPath;
    let m3u8Data = loadingRecord.m3u8Data
    const convert = await downloadTss(loadingRecord.totalUrls, m3u8Data, tempPath, loadingRecord.totalIndex, loadingRecord)
    if (convert && convert !== 'pause') {
        combineVideo(tempPath, outputPath, loadingRecord)
    }
}

/**
 * 发送下载进度
 */
const sendProcess = Throttle((loadingRecord) => {
    loadingRecord.message = {
        status: 'success',
        content: `下载完成${Number((loadingRecord.successTsNum / loadingRecord.totalUrls.length) * 100).toFixed(2)}%`
    }
}, 1000)

/**
 * 下载Ts文件
 * @returns {Promise<void>}
 */
export async function downloadTss(totalUrls, m3u8Data, tempPath, totalIndex, loadingRecord) {
    let m3u8DataString = await loopDownloadTs(totalUrls, m3u8Data, tempPath, totalIndex, loadingRecord)
    if(m3u8DataString !== 'pause') {
        let reloadNumber = 0
        while(loadingRecord.missLinks.length > 0 && reloadNumber < 100 && loadingRecord.pause === false) {
            reloadNumber ++
            m3u8DataString = await checkErrorTs(m3u8DataString, loadingRecord, reloadNumber, tempPath)
        }
        if(loadingRecord.pause) {
            loadingRecord.batchIndex = totalIndex
            await savePauseDownloadInfo(loadingRecord)
            return 'pause'
        } else {
            loadingRecord.isStart = false
            if(loadingRecord.missLinks.length > 0) {
                loadingRecord.message = {
                    status: 'error',
                    content: `下载失败，请重新进行下载!`
                }
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
    async function download(index) {
        if (index < totalIndex && loadingRecord.pause === false) {
            const pros = twoUrls[index]
            const promises = pros.map(async (item, subIndex) => {
                return await getFileAndStore(item.url, item.number, item.item, tempPath, newErrors, loadingRecord)
            })
            return Promise.all(promises)
                .then(async (results) => {
                    index = index + 1
                    return await download(index)
                })
        } else if(loadingRecord.pause) {
            loadingRecord.batchIndex = index
            loadingRecord.missLinks = newErrors
            await savePauseDownloadInfo(loadingRecord)
            return 'pause'
        } else {
            loadingRecord.missLinks = newErrors
            return await replaceTsFileUrls(totalUrls, m3u8Data, tempPath)
        }
    }
    return await download(loadingRecord.batchIndex || 0)
}

/**
 * 检测是否有错误ts下载，再次请求
 * @returns {Promise<void>}
 */
async function checkErrorTs(data, loadingRecord, reloadNumber, tempPath) {
    console.log('出现了请求失败了')
    console.log(loadingRecord.missLinks)
    console.log(`对失败的进行第${reloadNumber}次请求`)
    const newErrors = []
    const promises = loadingRecord.missLinks.map(async (item) => {
        return await getFileAndStore(item.url, item.number, item.item, tempPath, newErrors, loadingRecord)
    })
    return Promise.all(promises)
        .then(async () => {
            let m3u8Data = data
            loadingRecord.missLinks.forEach((item, index) => {
                m3u8Data = m3u8Data.replace(item.item, `./${item.number}.ts`)
            })
            await fs.writeFile(`${tempPath}/index.m3u8`, m3u8Data, "utf-8", (err) => {
                if(err) {
                    console.log('checkErrorTs failure')
                } else {
                    console.log('checkErrorTs success')
                }
            })
            loadingRecord.missLinks = newErrors
            return m3u8Data
        })
}

async function getFileAndStore(url, number, item, tempPath, errorList, loadingRecord) {
    const result = await axios.get(url, {
        timeout: 10000,
        responseType: "arraybuffer",
        headers: {
            "Content-Type": "application/octet-stream",
        }
    }).then(async (res) => {
        await fs.writeFile(`${tempPath}/${number}.ts`, res.data, 'binary', (err) => {
            if(err) {
                console.log('ts file create failure')
            } else {
                console.log('ts file create success')
            }
        })
        return 'success'
    }).catch((e) => {
        errorList.push({
            number: number,
            url: url,
            item: item
        })
        return 'failure'
    })
    if (result === 'success') {
        loadingRecord.successTsNum ++
        sendProcess(loadingRecord)
    }
    return result
}

async function replaceTsFileUrls(urls, data, tempPath) {
    let m3u8Data = data
    urls.forEach((item) => {
        m3u8Data = m3u8Data.replace(item.item, `./${item.number}.ts`)
    })
    await fs.writeFile(`${tempPath}/index.m3u8`, m3u8Data, "utf-8", (err) => {
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
 * 删除临时文件
 */
function deleteTempSource(tempPath) {
    deleteDirectory(tempPath)
}