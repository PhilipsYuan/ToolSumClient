import {m3u8VideoDownloadingListDB, m3u8VideoDownloadListDB} from "../../db/db";
import {ipcMain} from "electron";

ipcMain.handle('get-m3u8-loading-list', getLoadingList)
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
    const json = {
        name: data.name,
        m3u8Url: data.m3u8Url,
        process: '',
        message: {
            status: '',
            content: ''
        },
        // 下次执行的位置
        batchIndex: '',
        totalIndex: '',
        totalUrls: [],
        missLink: []
    }
    // 暂停时存储的json太大了。需要分文件存储
    m3u8VideoDownloadListDB.data.downloadList.unshift(data)
    await m3u8VideoDownloadListDB.write()
}