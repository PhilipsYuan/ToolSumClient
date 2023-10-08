import {splitArray} from '../../util/array';
import fs from "fs";
import Throttle from "../../util/throttle";
import {savePauseDownloadInfo} from "../processList/processList";
const axios = require('axios')

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
            await fs.writeFileSync(`${tempPath}/index.m3u8`, m3u8Data, "utf-8")
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
        await fs.writeFileSync(`${tempPath}/${number}.ts`, res.data, 'binary')
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
    await fs.writeFileSync(`${tempPath}/index.m3u8`, m3u8Data, "utf-8")
    return m3u8Data
}