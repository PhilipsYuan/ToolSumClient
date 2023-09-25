import {m3u8VideoDownloadingListDB, m3u8VideoDownloadListDB} from "../../db/db";
import {app, ipcMain} from "electron";
import {makeDir} from "../../util/fs";
import fs from "fs";
import shortId from "shortid";

const basePath = app.getPath('userData')
const processUrlsPath = `${basePath}/m3u8Video/processUrls`
makeDir(processUrlsPath)

ipcMain.handle('get-m3u8-loading-list', getLoadingList)
ipcMain.handle('delete-m3u8-loading-list', deleteLoadingRecordAndFile)
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
    const path = `${processUrlsPath}/${data.name}.txt`
    const id = shortId.generate()
    const json = {
        id: id,
        name: data.name,
        m3u8Url: data.m3u8Url,
        message: {
            status: '',
            content: ''
        },
        urlPath: path,
        // 下次执行的位置
        batchIndex: data.batchIndex,
        totalIndex: data.totalIndex,
    }
    await createProcessFile(path, data.totalUrls, data.m3u8Data, [])
    // 暂停时存储的json太大了。需要分文件存储
    m3u8VideoDownloadingListDB.data.loadingList.unshift(json)
    await m3u8VideoDownloadingListDB.write()
}

/**
 * 独立文件处理下载过程中的总共Urls和missLinks
 * @returns {Promise<void>}
 */
export async function createProcessFile (path, totalUrls, m3u8Data, missLinks) {
    const json = {
        totalUrls,
        m3u8Data,
        missLinks
    }
    await fs.writeFileSync(path, global.JSON.stringify(json), "utf-8")
}


/**
 * 删除记录和列表
 * @returns {Promise<void>}
 */
export async function deleteLoadingRecordAndFile(event, id) {
    const list = m3u8VideoDownloadingListDB.data.loadingList
    const index = list.findIndex((item) => item.id === id)
    if(index > -1) {
        const path = m3u8VideoDownloadingListDB.data.loadingList[index].urlPath;
        if(path && fs.existsSync(path)) {
            fs.unlinkSync(path)
        }
        m3u8VideoDownloadingListDB.data.loadingList.splice(index, 1)
        await m3u8VideoDownloadingListDB.write()
    }
}