import {app, ipcMain} from "electron";
import fs from "fs";
import {getSecretKeys, getCorrectM3u8File, getPlayList, getXMap} from "../../../util/m3u8Parse"
import {deleteDirectory, makeDir, getFileInfo} from "../../../util/fs"
import { newLoadingRecord} from '../../processList/processList';
import axios from '../../../util/source/axios'
import path from "path";
import {createWork, updateWork} from "./workManager";
import {m3u8VideoDownloadingListDB} from "../../../db/db";
import shortId from "shortid";
import {getHeaders} from "../../../util/httpHeaders";
import dayjs from "dayjs";

const basePath = app.getPath('userData');
const tempSourcePath = path.resolve(basePath, 'm3u8Video', 'tempSource')
makeDir(tempSourcePath)

ipcMain.handle('check-download-file-not-exist', checkDownloadFileNotExist);
ipcMain.handle('create-m3u8-download-task', createM3u8DownloadTask);

/**
 * 创建m3u8下载任务
 */
export async function createM3u8DownloadTask(event, url, name, outPath, htmlUrl, audioUrl,  isUpdate, loadingId) {
    if(/m3u8Video[/|\\]tempM3u8Url/.test(url)) {
        return createOtherM3u8DownloadTask(url, name, outPath, htmlUrl, isUpdate, loadingId)
    } else {
        return createNormalM3u8DownloadTask(url, name, outPath, htmlUrl, isUpdate, loadingId)
    }
}


/**
 * 存储在本地的m3u8文件进行解析
 */
async function createOtherM3u8DownloadTask(url, name, outPath, htmlUrl, isUpdate, loadingId) {
    try {
        const outputPath = path.resolve(outPath, `${name}.mp4`);
        if (checkOutputFileNotExist(null, outputPath)) {
            const tempPath = path.resolve(tempSourcePath, name);
            makeDir(tempPath)
            // const info = JSON.parse(getFileInfo(url))
            const info = getFileInfo(url)
            const m3u8Data = await downloadSecretKey(info, null, tempPath, null, null)
            const urls = getPlayList(info)
            const formatUrls = urls.map((item, index) => {
                let url = ''
                if (/^http/.test(item)) {
                    url = item
                } else {
                    if(info.host) {
                        url = info.host + item
                    } else {
                        url = item
                    }
                }
                return {
                    item, url, number: index + 1, cookie: info.cookie
                }
            })
            if(isUpdate) {
                await UpdateLoadingRecord({
                    htmlUrl: htmlUrl,
                    name: name,
                    m3u8Url: url,
                    m3u8Data: m3u8Data,
                    totalUrls: formatUrls,
                    outputPath: outputPath
                }, loadingId)
            } else {
                await createNewLoadingRecord({
                    htmlUrl: htmlUrl,
                    name: name,
                    m3u8Url: url,
                    m3u8Data: m3u8Data,
                    totalUrls: formatUrls,
                    outputPath: outputPath
                })
            }

            return 'success'
        } else {
            return 'failure'
        }
    } catch (e) {
        console.log(e)
        return 'failure'
    }

}

/**
 * https的链接m3u8地址的处理
 * @param url
 * @returns {*}
 */
function createNormalM3u8DownloadTask(url, name, outPath, htmlUrl, isUpdate, loadingId) {
    try{
        const outputPath = path.resolve(outPath, `${name}.mp4`);
        if (checkOutputFileNotExist(null, outputPath)) {
            const tempPath = path.resolve(tempSourcePath, name);
            makeDir(tempPath)
            return getCorrectM3u8File(url)
                .then(async (data) => {
                    if (data) {
                        const urlObject = new URL(url);
                        const host = `${urlObject.protocol}//${urlObject.host}`
                        let m3u8Data = await downloadSecretKey(data, host, tempPath, urlObject.pathname)
                        m3u8Data = await downloadMap(m3u8Data, host, tempPath, urlObject.pathname)
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
                        if(isUpdate) {
                            await UpdateLoadingRecord({
                                htmlUrl: htmlUrl,
                                name: name,
                                m3u8Url: url,
                                m3u8Data: m3u8Data,
                                totalUrls: formatUrls,
                                outputPath: outputPath
                            }, loadingId)
                        } else {
                            await createNewLoadingRecord({
                                htmlUrl: htmlUrl,
                                name: name,
                                m3u8Url: url,
                                m3u8Data: m3u8Data,
                                totalUrls: formatUrls,
                                outputPath: outputPath
                            })
                        }

                        return 'success'
                    } else {
                        return 'failure'
                    }
                })
        }
    } catch (e) {
        console.log(e)
        return 'failure'
    }
}

 async function createNewLoadingRecord(data) {
    const id = shortId.generate()
    const json = {
        id: id,
        name: data.name,
        htmlUrl: data.htmlUrl || '',
        m3u8Url: data.m3u8Url,
        type: 'm3u8',
        message: {
            status: 'success',
            content: '未开始进行下载'
        },
        // 判断是否在进行中
        pausing: false,
        pause: false,
        isStart: false,
        successTsNum: 0,
        outputPath: data.outputPath,
        updateDate: dayjs().format("YYYY/MM/DD HH:mm")
    }
     const processUrlsPath = path.resolve(basePath, 'm3u8Video', 'processUrls');
     const urlPath = path.resolve(processUrlsPath, `${data.name}.txt`);
     json.urlPath = urlPath
     // 暂停时存储的json太大了。需要分文件存储
     await createProcessFile(urlPath, data.totalUrls, data.m3u8Data)
     newLoadingRecord(json)
}

async function UpdateLoadingRecord(data, id) {
    const list = m3u8VideoDownloadingListDB.data.loadingList
    const item = list.find((item) => item.id === id)
    item.m3u8Url = data.m3u8Url
    const processUrlsPath = path.resolve(basePath, 'm3u8Video', 'processUrls');
    const urlPath = path.resolve(processUrlsPath, `${data.name}.txt`);
    item.urlPath = urlPath
    item.successTsNum = 0
    item.message = {
        status: 'success',
        content: '未开始进行下载'
    }
    item.updateDate = dayjs().format("YYYY/MM/DD HH:mm")
    // 暂停时存储的json太大了。需要分文件存储
    await createProcessFile(urlPath, data.totalUrls, data.m3u8Data)
    await m3u8VideoDownloadingListDB.write()
}

/**
 * 下载解码key，并进行替换,
 * 文件里可能会出现多个
 */
async function downloadSecretKey(data, host, tempPath, pathname, cookie) {
    const keys = getSecretKeys(data)
    let i = 0;
    let m3u8Data = data
    if (keys.length > 0) {
        while (i < keys.length) {
            let url = null
            if(cookie) {
                url = host + '/' + keys[i]
            } else {
                if (keys[i][0] !== '/' && !/^http/.test(keys[i])) {
                    url = host + pathname.match(/\/.*\//)[0] + keys[i]
                } else if (/^http/.test(keys[i])) {
                    url = keys[i]
                } else {
                    url = host + keys[i]
                }
            }

            const headers = getHeaders(url)
            headers["Content-Type"] = "application/octet-stream"
            if(cookie) {
                headers.Cookie = cookie
            }
            const res = await axios.get(url, {
                responseType: "arraybuffer",
                headers: headers
            })
            const dyData = new Uint8Array(res.data);
            await fs.writeFileSync(path.resolve(tempPath, `key${i + 1}.key`), dyData, "utf-8")
            i++
        }
        keys.forEach((item, index) => {
            const regex = new RegExp(item, 'g')
            m3u8Data = m3u8Data.replace(regex, path.resolve(tempPath, `key${index + 1}.key`).replace(/\\/g, '/'))
        })
        await fs.writeFileSync(path.resolve(tempPath, `index.m3u8`), m3u8Data, "utf-8")
    }
    return m3u8Data
}

/**
 * EXT-X-MAP 进行替换
 * @param data
 * @param host
 * @param tempPath
 * @param pathname
 * @param cookie
 */
async function downloadMap(data, host, tempPath, pathname, cookie) {
    const keys = getXMap(data)
    let i = 0;
    let m3u8Data = data
    if (keys.length > 0) {
        while (i < keys.length) {
            let url = null
            if(cookie) {
                url = host + '/' + keys[i]
            } else {
                if (keys[i][0] !== '/' && !/^http/.test(keys[i])) {
                    url = host + pathname.match(/\/.*\//)[0] + keys[i]
                } else if (/^http/.test(keys[i])) {
                    url = keys[i]
                } else {
                    url = host + keys[i]
                }
            }

            const headers = getHeaders(url)
            headers["Content-Type"] = "application/octet-stream"
            if(cookie) {
                headers.Cookie = cookie
            }
            const res = await axios.get(url, {
                responseType: "arraybuffer",
                headers: headers
            })
            const dyData = new Uint8Array(res.data);
            await fs.writeFileSync(path.resolve(tempPath, `map${i + 1}.map`), dyData, "utf-8")
            i++
        }
        keys.forEach((item, index) => {
            const regex = new RegExp(item, 'g')
            m3u8Data = m3u8Data.replace(regex, path.resolve(tempPath, `map${index + 1}.map`).replace(/\\/g, '/'))
        })
        await fs.writeFileSync(path.resolve(tempPath, `index.m3u8`), m3u8Data, "utf-8")
    }
    return m3u8Data
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
 * 测试下载的文件是否不存在，不存在才可以进行下载。
 * name 是文件名称，
 * downloadPath 是存储下载地方
 * @param event
 * @param path
 * @returns {boolean}
 */
function checkDownloadFileNotExist(event, name, downloadPath) {
    const outputPath = path.resolve(downloadPath, `${name}.mp4`);
    return checkOutputFileNotExist(null, outputPath)
}

/**
 * 开始下载M3u8Video
 */
export function startDownloadM3u8Video(item) {
    const string = fs.readFileSync(item.urlPath, 'utf-8')
    const json = global.JSON.parse(string)
    item.totalUrls = json.totalUrls
    item.m3u8Data = json.m3u8Data
    createWork(item)
}

/**
 * 删除loading的记录和列表
 */
export async function deleteM3u8loadingRecordAndFile(item) {
    if(item.isStart && !item.pause) {
        await pauseM3u8DownloadVideo(item)
        const interval = setInterval(async () => {
            if(item.isStart && item.pause && !item.pausing) {
                clearInterval(interval);
                await deleteRecordAndFile(item)
            }
        },500)
    } else {
        await deleteRecordAndFile(item)
    }
}

/**
 * 删除记录和相关的文件
 * @param item
 * @param index
 * @returns {Promise<void>}
 */
async function deleteRecordAndFile(item) {
    const urlPath = item.urlPath;
    const tempPath = path.resolve(tempSourcePath, item.name);
    deleteDirectory(tempPath)
    if(urlPath && fs.existsSync(urlPath)) {
        fs.unlinkSync(urlPath)
    }
    if(/m3u8Video[/|\\]tempM3u8Url/.test(item.m3u8Url) && fs.existsSync(item.m3u8Url)) {
        fs.unlinkSync(item.m3u8Url)
    }
}

/**
 * 暂停下载视频
 * @returns {Promise<void>}
 */
export async function pauseM3u8DownloadVideo(item) {
    item.pause = true
    item.pausing = true
    updateWork(item)
}

/**
 * 保存暂停时数据
 * @returns {Promise<void>}
 */
export async function savePauseDownloadInfo(record) {
    const list = m3u8VideoDownloadingListDB.data.loadingList
    const index = list.findIndex((item) => item.id === record.id)
    if(index > -1) {
        list[index].batchIndex = record.batchIndex
        await createProcessFile(record.urlPath, record.totalUrls, record.m3u8Data)
        list[index].pausing = false
    }
    await m3u8VideoDownloadingListDB.write()
}

export async function continueM3u8DownloadVideo(item) {
    createWork(item)
}

/**
 * 独立文件处理下载过程中的总共Urls
 * @returns {Promise<void>}
 */
export async function createProcessFile (path, totalUrls, m3u8Data) {
    const json = {
        totalUrls,
        m3u8Data
    }
    if(fs.existsSync(path)) {
        fs.unlinkSync(path)
    }
    await fs.writeFileSync(path, global.JSON.stringify(json), "utf-8")
}