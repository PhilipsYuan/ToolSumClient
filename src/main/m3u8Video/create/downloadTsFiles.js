import {getPlayList} from "../../util/m3u8Parse";
import fs from "fs";
import {sendTips} from '../../util/electronSendTips'
import Throttle from '../../util/throttle'
const axios = require('axios')

// 请求出错的暂存
let firstError = []
// 再次请求后再出错的暂存
let secondError = []
let thirdError = []
let fourthError = []
let fiveError = []
let successTs = 0
let totalTs = 0

/**
 * 发送下载进度
 */
const sendProcess = Throttle(() => {
    sendTips('m3u8-download-tip', `下载完成${Number((successTs / totalTs) * 100).toFixed(2)}%`)
}, 1000)

export async function downloadTsFiles(data, host, tempPath, pathname) {
    sendTips('m3u8-download-tip', '下载0%')
    firstError = [];
    secondError = [];
    thirdError = [];
    fourthError = [];
    fiveError = [];
    successTs = 0;
    totalTs = 0;
    let m3u8Data = await downloadAllContent(data, host, tempPath, pathname)
    if (firstError.length > 0) {
        m3u8Data = await checkFirstErrorTs(m3u8Data, host, tempPath, pathname)
    }
    if (secondError.length > 0) {
        m3u8Data = await checkSecondErrorTs(m3u8Data, host, tempPath, pathname)
    }
    if (thirdError.length > 0) {
        m3u8Data = await checkThirdErrorTs(m3u8Data, host, tempPath, pathname)
    }
    if (fourthError.length > 0) {
        m3u8Data = await checkFourthErrorTs(m3u8Data, host, tempPath, pathname)
    }
    if (fiveError.length > 0) {
        // 告诉下载失败，请再次重试
        sendTips('m3u8-download-tip', '下载失败，请重新进行下载!')
    }
    return m3u8Data
}

async function downloadAllContent(data, host, tempPath, pathname) {
    const {urls, httpsUrls } = getPlayList(data)
    const m3u8Data = await deleteAdLinks(data, host, httpsUrls, tempPath)
    totalTs = urls.length

    // const promises = urls.map(async (item, subIndex) => {
    //     const number = 1 + subIndex
    //     let url = null
    //     if (item[0] !== '/') {
    //         url = host + pathname.match(/\/.*\//)[0] + item
    //     } else {
    //         url = host + item
    //     }
    //     return await getFileAndStore(url, number, item, pathname, tempPath, firstError)
    // })
    // return Promise.all(promises)
    //     .then(async () => {
    //         return await replaceTsFileUrls(urls, data, tempPath)
    //     })

    const twoUrls = splitArray(urls, 100)
    const length = twoUrls.length
    async function download(index) {
        if (index < length) {
            const pros = twoUrls[index]
            const promises = pros.map(async (item, subIndex) => {
                const number = index * 100 + 1 + subIndex
                let url = null
                if (item[0] !== '/') {
                    url = host + pathname.match(/\/.*\//)[0] + item
                } else {
                    url = host + item
                }
               return await getFileAndStore(url, number, item, pathname, tempPath, firstError)
            })
            return Promise.all(promises)
                .then(async (results) => {
                    index = index + 1
                    return await download(index)
                })
        } else {
            return await replaceTsFileUrls(urls, m3u8Data, tempPath)
        }
    }

    return await download(0)
}

/**
 * 检测是否有错误ts下载，再次请求
 * @returns {Promise<void>}
 */
async function checkFirstErrorTs(data, host, tempPath, pathname) {
    console.log('出现了请求失败了')
    console.log(firstError)
    console.log('对失败的进行第二次请求')
    const promises = firstError.map(async (item, subIndex) => {
        return await getFileAndStore(item.url, item.number, host, pathname, tempPath, secondError)
    })
    return Promise.all(promises)
        .then(async () => {
            let m3u8Data = data
            firstError.forEach((item, index) => {
                m3u8Data = m3u8Data.replace(item.item, `./${item.number}.ts`)
            })
            await fs.writeFileSync(`${tempPath}/index.m3u8`, m3u8Data, "utf-8")
            return m3u8Data
        })
}

/**
 * 检测是否有错误ts下载，再次请求
 * @returns {Promise<void>}
 */
async function checkSecondErrorTs(data, host, tempPath, pathname) {
    console.log('第二次请求失败了')
    console.log(secondError)
    console.log('对失败的进行第三次请求')
    const promises = secondError.map(async (item, subIndex) => {
        return await getFileAndStore(item.url, item.number, host, pathname, tempPath, thirdError)
    })
    return Promise.all(promises)
        .then(async () => {
            let m3u8Data = data
            secondError.forEach((item, index) => {
                m3u8Data = m3u8Data.replace(item.item, `./${item.number}.ts`)
            })
            await fs.writeFileSync(`${tempPath}/index.m3u8`, m3u8Data, "utf-8")
            return m3u8Data
        })
}

/**
 * 检测是否有错误ts下载，再次请求
 * @returns {Promise<void>}
 */
async function checkThirdErrorTs(data, host, tempPath, pathname) {
    console.log('第三次请求失败了')
    console.log(thirdError)
    console.log('对失败的进行第四次请求')
    const promises = thirdError.map(async (item, subIndex) => {
        return await getFileAndStore(item.url, item.number, host, pathname, tempPath, fourthError)
    })
    return Promise.all(promises)
        .then(async () => {
            let m3u8Data = data
            thirdError.forEach((item, index) => {
                m3u8Data = m3u8Data.replace(item.item, `./${item.number}.ts`)
            })
            await fs.writeFileSync(`${tempPath}/index.m3u8`, m3u8Data, "utf-8")
            return m3u8Data
        })
}

/**
 * 检测是否有错误ts下载，再次请求
 * @returns {Promise<void>}
 */
async function checkFourthErrorTs(data, host, tempPath, pathname) {
    console.log('第四次请求失败了')
    console.log(fourthError)
    console.log('对失败的进行第五次请求')
    const promises = fourthError.map(async (item, subIndex) => {
        return await getFileAndStore(item.url, item.number, host, pathname, tempPath, fiveError)
    })
    return Promise.all(promises)
        .then(async () => {
            let m3u8Data = data
            fourthError.forEach((item, index) => {
                m3u8Data = m3u8Data.replace(item.item, `./${item.number}.ts`)
            })
            await fs.writeFileSync(`${tempPath}/index.m3u8`, m3u8Data, "utf-8")
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
async function getFileAndStore(url, number, item, pathname, tempPath, errorList) {
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
        successTs++
        sendProcess()
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
 * 删除m3u8里的广告
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