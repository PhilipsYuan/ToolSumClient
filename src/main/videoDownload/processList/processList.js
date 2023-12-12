import { m3u8VideoDownloadingListDB } from "../../db/db";
import {app, ipcMain} from "electron";
import {deleteDirectory, makeDir} from "../../util/fs";
import fs from "fs";
import shortId from "shortid";
import {createWork, updateWork} from '../videoType/m3u8Video/workManager';
import {sendTips} from "../../util/source/electronOperations";
import path from "path";
import {startDownloadM3u8Video} from "../videoType/m3u8Video/m3u8Video";
import {startDownloadMagnetVideo} from "../videoType/magnet/magnet";

const basePath = app.getPath('userData')
const processUrlsPath = path.resolve(basePath, 'm3u8Video', 'processUrls');
const tempSourcePath = path.resolve(basePath, 'm3u8Video', 'tempSource');
makeDir(processUrlsPath)

ipcMain.handle('get-m3u8-loading-list', getLoadingList)
ipcMain.handle('delete-m3u8-loading-list', deleteLoadingRecordAndFile)
ipcMain.handle('start-download-video', startDownloadVideo)
ipcMain.handle('pause-m3u8-download-Video', pauseDownloadVideo)
ipcMain.handle('continue-m3u8-download-Video', continueDownloadVideo)
/**
 * 获取下载中的记录
 */
function getLoadingList () {
    const list = m3u8VideoDownloadingListDB.data.loadingList
    return list
}

/**
 * 新增一条下载中的记录
 * @param event
 * @param stockCode
 * @param data
 * @returns {string|*}
 */
export async function newLoadingRecord (data) {
    const id = shortId.generate()
    const type = data.type || 'm3u8'
    const json = {
        id: id,
        name: data.name,
        m3u8Url: data.m3u8Url,
        type: type,
        message: {
            status: 'success',
            content: '未开始进行下载'
        },
        // 判断是否在进行中
        pausing: false,
        pause: false,
        isStart: false,
        successTsNum: 0,
        outputPath: data.outputPath
    }
    if(type === 'm3u8') {
        const urlPath = path.resolve(processUrlsPath, `${data.name}.txt`);
        json.urlPath = urlPath
        // 暂停时存储的json太大了。需要分文件存储
        await createProcessFile(urlPath, data.totalUrls, data.m3u8Data)
    }
    m3u8VideoDownloadingListDB.data.loadingList.unshift(json)
    await m3u8VideoDownloadingListDB.write()
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
    await fs.writeFileSync(path, global.JSON.stringify(json), "utf-8")
}


/**
 * 删除记录和列表
 * @returns {Promise<void>}
 */
export async function deleteLoadingRecordAndFile(event, id, callType = 'delete') {
    const list = m3u8VideoDownloadingListDB.data.loadingList
    const index = list.findIndex((item) => item.id === id)
    if(index > -1) {
        const item = m3u8VideoDownloadingListDB.data.loadingList[index]
        if(item.isStart && !item.pause) {
            await pauseDownloadVideo(null, id)
            const interval = setInterval(async () => {
                if(item.isStart && item.pause && !item.pausing) {
                    clearInterval(interval);
                    await deleteRecordAndFile(item, index, callType)
                }
            },500)
        } else {
            await deleteRecordAndFile(item, index, callType)
        }
    }
}

/**
 * 删除记录和列表
 */
async function deleteRecordAndFile(item, index, callType) {
    const urlPath = item.urlPath;
    const tempPath = path.resolve(tempSourcePath, item.name);
    deleteDirectory(tempPath)
    if(urlPath && fs.existsSync(urlPath)) {
        fs.unlinkSync(urlPath)
    }
    m3u8VideoDownloadingListDB.data.loadingList.splice(index, 1)
    await m3u8VideoDownloadingListDB.write()
    sendTips("delete-m3u8-loading-success", callType)
}

/**
 * 开始下载资源
 * @param event
 * @param id
 * @returns {Promise<void>}
 */

export async function startDownloadVideo(event, id) {
    const list = m3u8VideoDownloadingListDB.data.loadingList
    const index = list.findIndex((item) => item.id === id)
    if(index > -1) {
        const item = m3u8VideoDownloadingListDB.data.loadingList[index];
        item.isStart = true
        item.message = {
            status: 'success',
            content: `开始下载中...`
        }
        if(item.type === 'magnet') {
            startDownloadMagnetVideo(item)
        } else {
            startDownloadM3u8Video(item)
        }
    }
}

/**
 * 暂停下载视频
 * @returns {Promise<void>}
 */
export async function pauseDownloadVideo(event, id) {
    const list = m3u8VideoDownloadingListDB.data.loadingList
    const index = list.findIndex((item) => item.id === id)
    if(index > -1) {
        const item = m3u8VideoDownloadingListDB.data.loadingList[index];
        item.pause = true
        item.pausing = true
        updateWork(item)
    }
}

/**
 * 暂停后继续下载视频
 * @returns {Promise<void>}
 */
export async function continueDownloadVideo(event, id) {
    const list = m3u8VideoDownloadingListDB.data.loadingList
    const index = list.findIndex((item) => item.id === id)
    if(index > -1) {
        const item = m3u8VideoDownloadingListDB.data.loadingList[index];
        item.pause = false
        createWork(item)
    }
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
