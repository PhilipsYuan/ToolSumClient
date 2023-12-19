import { m3u8VideoDownloadingListDB } from "../../db/db";
import {app, ipcMain} from "electron";
import { makeDir} from "../../util/fs";
import {sendTips} from "../../util/source/electronOperations";
import path from "path";
import {
    continueM3u8DownloadVideo,
    deleteM3u8loadingRecordAndFile,
    pauseM3u8DownloadVideo,
    startDownloadM3u8Video
} from "../videoType/m3u8Video/m3u8Video";
import {
    continueMagnetDownloadVideo,
    deleteMagnetLoadingRecordAndFile,
    pauseMagnetDownloadVideo,
    startDownloadMagnetVideo
} from "../videoType/magnet/magnet";
import {startDownloadBiliVideo} from "../videoType/bilibiliVideo/bilibiliVideo";

const basePath = app.getPath('userData')
const processUrlsPath = path.resolve(basePath, 'm3u8Video', 'processUrls');
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
export async function newLoadingRecord (json) {
    m3u8VideoDownloadingListDB.data.loadingList.unshift(json)
    await m3u8VideoDownloadingListDB.write()
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
        if(item.type === 'magnet') {
            await deleteMagnetLoadingRecordAndFile(item, callType)
        } else {
            await deleteM3u8loadingRecordAndFile(item)
        }
        m3u8VideoDownloadingListDB.data.loadingList.splice(index, 1)
        await m3u8VideoDownloadingListDB.write()
        sendTips("delete-m3u8-loading-success", callType)
    }
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
        } else if(item.type === 'biliTV') {
            startDownloadBiliVideo(item)
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
        if(item.type === 'magnet') {
            await pauseMagnetDownloadVideo(item)
        } else {
            await pauseM3u8DownloadVideo(item)
        }
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
        if(item.type === 'magnet') {
            await continueMagnetDownloadVideo(item)
        } else {
            await continueM3u8DownloadVideo(item)
        }
    }
}
