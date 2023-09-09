import {ipcMain} from "electron";
import { m3u8VideoDownloadListDB } from "../../db/db";
import fs from "fs";

ipcMain.handle('get-m3u8-finish-list', getFinishList)
ipcMain.handle('delete-m3u8-finished-record', deleteFinishedRecord)
ipcMain.handle('delete-m3u8-record-and-file', deleteFinishedRecordAndFile)

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
async function getFinishList () {
    const list = m3u8VideoDownloadListDB.data.downloadList
    return checkListStatus(list) || []
}

/**
 * 新增一条历史记录
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