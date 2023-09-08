import {ipcMain} from "electron";
import { m3u8VideoDownloadListDB } from "../../db/db";

ipcMain.handle('get-m3u8-finish-list', getFinishList)


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
    return list || []
}

/**
 * 新增一条历史记录
 * @param event
 * @param stockCode
 * @param data
 * @returns {string|*}
 */
export async function deleteFinishedRecord (data) {
    // historyHoldStocksDB.data.stocks.unshift(data)
    // await historyHoldStocksDB.write()
}