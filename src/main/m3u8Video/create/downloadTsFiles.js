import {getPlayList} from "../../util/m3u8Parse";
import fs from "fs";
import {sendTips} from '../../util/electronOperations'
import Throttle from '../../util/throttle'
const axios = require('axios')

/**
 * 发送下载进度
 */
const sendProcess = Throttle((batchTs) => {
    sendTips('m3u8-download-tip', 'success', `下载完成${Number((batchTs.successTs / batchTs.totalTs) * 100).toFixed(2)}%`)
}, 1000)

export async function downloadTsFiles(data, host, tempPath, pathname) {
    sendTips('m3u8-download-tip', 'success', '下载0%')
    const batchTs = {
        errorList: [],
        successTs: 0,
        totalTs: 0
    }
    let reloadNumber = 0
    let m3u8Data = await downloadAllContent(data, host, tempPath, pathname, batchTs)
    while(batchTs.errorList.length > 0 && reloadNumber < 50) {
        reloadNumber ++
        m3u8Data = await checkErrorTs(m3u8Data, host, tempPath, pathname, batchTs, reloadNumber)
    }
    if(batchTs.errorList.length > 0) {
        sendTips('m3u8-download-tip', 'error','下载失败，请重新进行下载!')
    }
    return m3u8Data
}

async function downloadAllContent(data, host, tempPath, pathname, batchTs) {
    const urls = getPlayList(data)
    const m3u8Data = data
    batchTs.totalTs = urls.length
    const twoUrls = splitArray(urls, 100)
    const length = twoUrls.length
    const newErrors = []
    async function download(index) {
        if (index < length) {
            const pros = twoUrls[index]
            const promises = pros.map(async (item, subIndex) => {
                const number = index * 100 + 1 + subIndex
                let url = null
                if (item[0] !== '/' && !/^http/.test(item)) {
                    url = host + pathname.match(/\/.*\//)[0] + item
                } else if(/^http/.test(item)) {
                     url = item
                } else {
                    url = host + item
                }
               return await getFileAndStore(url, number, item, pathname, tempPath, newErrors, batchTs);
            })
            return Promise.all(promises)
                .then(async (results) => {
                    index = index + 1
                    return await download(index)
                })
        } else {
            batchTs.errorList = newErrors
            return await replaceTsFileUrls(urls, m3u8Data, tempPath)
        }
    }

    return await download(0)
}

/**
 * 检测是否有错误ts下载，再次请求
 * @returns {Promise<void>}
 */
async function checkErrorTs(data, host, tempPath, pathname, batchTs, reloadNumber) {
    console.log('出现了请求失败了')
    console.log(batchTs)
    console.log(`对失败的进行第${reloadNumber}次请求`)
    const newErrors = []
    const promises = batchTs.errorList.map(async (item, subIndex) => {
        return await getFileAndStore(item.url, item.number, host, pathname, tempPath, newErrors, batchTs)
    })
    return Promise.all(promises)
        .then(async () => {
            let m3u8Data = data
            batchTs.errorList.forEach((item, index) => {
                m3u8Data = m3u8Data.replace(item.item, `./${item.number}.ts`)
            })
            await fs.writeFileSync(`${tempPath}/index.m3u8`, m3u8Data, "utf-8")
            batchTs.errorList = newErrors
            return m3u8Data
        })
}

/**
 * 替换m3u8里ts文件路径
 * @param urls
 * @param data
 * @param tempPath
 * @returns {Promise<void>}
 */
async function replaceTsFileUrls(urls, data, tempPath) {
    let m3u8Data = data
    urls.forEach((item, index) => {
        m3u8Data = m3u8Data.replace(item, `./${index + 1}.ts`)
    })
    await fs.writeFileSync(`${tempPath}/index.m3u8`, m3u8Data, "utf-8")
    return m3u8Data
}

/**
 * 获取分片文件，然后存储到临时文件夹中
 */
async function getFileAndStore(url, number, item, pathname, tempPath, errorList, batchTs) {
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
        batchTs.successTs ++
        sendProcess(batchTs)
    }
    return result
}

/**
 * 将数组分拆成多个数组
 * @param array 原数组
 * @param subGroupLength 拆分的每组的数量。
 * @returns {*[]}
 */
function splitArray(array, subGroupLength) {
    let index = 0;
    let newArray = [];
    while (index < array.length) {
        newArray.push(array.slice(index, index += subGroupLength));
    }
    return newArray;
}

/**
 * 删除m3u8里的广告，暂不用，没法判断出链接请求是否是广告
 */
async function deleteAdLinks(data, host, httpsUrl, tempPath) {
    let m3u8Data = data
    httpsUrl.forEach((item) => {
        const reg = new RegExp(`#EXTINF:.*,[\n\r]${item}`, 'g')
        m3u8Data = m3u8Data.replace(reg, ``)
    })
    await fs.writeFileSync(`${tempPath}/index.m3u8`, m3u8Data, "utf-8")
    return m3u8Data
}