import {ipcMain} from "electron";
import { m3u8VideoDownloadListDB, m3u8VideoDownloadingListDB } from "../../db/db";
import fs from "fs";

ipcMain.handle('get-m3u8-finish-list', getFinishList)
ipcMain.handle('delete-m3u8-finished-record', deleteFinishedRecord)
ipcMain.handle('delete-m3u8-record-and-file', deleteFinishedRecordAndFile)
ipcMain.handle('check-download-url-not-exist', checkDownloadUrlNotExist)

/**
 * 新增一条历史记录
 * @param event
 * @param stockCode
 * @param data
 * @returns {string|*}
 */
export async function newFinishedRecord (data) {
    m3u8VideoDownloadListDB.data.downloadList.unshift(data)
    await m3u8VideoDownloadListDB.write()
}

/**
 * 获取历史记录。
 * @returns {Promise<*|[]|*[]>}
 */
async function getFinishList (event, query) {
    if(query) {
        const regex = new RegExp(query)
        if(isUrl(query)) {
            const list  = m3u8VideoDownloadListDB.data.downloadList.filter((item) => {
                return regex.test(item.m3u8Url)
            })
            return list || []
        } else {

            const list  = m3u8VideoDownloadListDB.data.downloadList.filter((item) => {
                return regex.test(item.name)
            })
            return list || []
        }
    } else {
        const list = m3u8VideoDownloadListDB.data.downloadList
        return checkListStatus(list) || []
    }
}

/**
 * 删除记录
 * @param event
 * @param stockCode
 * @param data
 * @returns {string|*}
 */
export async function deleteFinishedRecord (event, id) {
    const list = m3u8VideoDownloadListDB.data.downloadList
    const index = list.findIndex((item) => item.id === id)
    if(index > -1) {
        m3u8VideoDownloadListDB.data.downloadList.splice(index, 1)
        await m3u8VideoDownloadListDB.write()
    }
}

/**
 * 删除记录和列表
 * @returns {Promise<void>}
 */
export async function deleteFinishedRecordAndFile(event, id) {
    const list = m3u8VideoDownloadListDB.data.downloadList
    const index = list.findIndex((item) => item.id === id)
    if(index > -1) {
        const path = m3u8VideoDownloadListDB.data.downloadList[index].filePath;
        if(path && fs.existsSync(path)) {
            fs.unlinkSync(path)
        }
        m3u8VideoDownloadListDB.data.downloadList.splice(index, 1)
        await m3u8VideoDownloadListDB.write()
    }
}

/**
 * 校验下载链接是否已经下载过
 * @returns {Promise<boolean>}
 */
export async function checkDownloadUrlNotExist(event, url, name) {
    const list = m3u8VideoDownloadListDB.data.downloadList
    const loadingList = m3u8VideoDownloadingListDB.data.loadingList
    const index = list.findIndex((item) => item.m3u8Url === url || item.name === name)
    const loadingIndex = loadingList.findIndex((item) => item.m3u8Url === url || item.name === name)
    if(index > -1) {
        return list[index]
    } else if(loadingIndex > -1) {
        return loadingList[loadingIndex]
    } else {
        return {}
    }
}

export function checkListStatus (list) {
    list.forEach((item) => {
        if(fs.existsSync(item.filePath)) {
            item.isExist = true
        } else {
            item.isExist = false
        }
    })
    return list
}

function isUrl(str) {
    return /(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/.test(str)
}