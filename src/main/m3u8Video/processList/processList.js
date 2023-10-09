import { m3u8VideoDownloadingListDB } from "../../db/db";
import {app, ipcMain} from "electron";
import {deleteDirectory, makeDir} from "../../util/fs";
import fs from "fs";
import shortId from "shortid";
import {createWork, updateWork} from '../create/workManager';
import {sendTips} from "../../util/electronOperations";

const basePath = app.getPath('userData')
const processUrlsPath = `${basePath}/m3u8Video/processUrls`
const tempSourcePath = `${basePath}/m3u8Video/tempSource`;
makeDir(processUrlsPath)

ipcMain.handle('get-m3u8-loading-list', getLoadingList)
ipcMain.handle('delete-m3u8-loading-list', deleteLoadingRecordAndFile)
ipcMain.handle('start-download-one-loading', startDownloadLoading)
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
    const path = `${processUrlsPath}/${data.name}.txt`
    const id = shortId.generate()
    const json = {
        id: id,
        name: data.name,
        m3u8Url: data.m3u8Url,
        message: {
            status: 'success',
            content: '未开始进行下载'
        },
        urlPath: path,
        // 判断是否在进行中
        pausing: false,
        pause: false,
        isStart: false,
        successTsNum: 0,
        // 下次执行的位置
        batchIndex: data.batchIndex,
        totalIndex: data.totalIndex,
        outputPath: data.outputPath
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
        const item = m3u8VideoDownloadingListDB.data.loadingList[index]
        if(item.isStart && !item.pause) {
            await pauseDownloadVideo(null, id)
            const interval = setInterval(async () => {
                if(item.isStart && item.pause && !item.pausing) {
                    clearInterval(interval);
                    await deleteRecordAndFile(item, index)
                }
            },500)
        } else {
            await deleteRecordAndFile(item, index)
        }
    }
}

/**
 * 删除记录和列表
 */
async function deleteRecordAndFile(item, index) {
    const path = item.urlPath;
    const tempPath = `${tempSourcePath}/${item.name}`;
    deleteDirectory(tempPath)
    if(path && fs.existsSync(path)) {
        fs.unlinkSync(path)
    }
    m3u8VideoDownloadingListDB.data.loadingList.splice(index, 1)
    await m3u8VideoDownloadingListDB.write()
    sendTips("delete-m3u8-loading-success")
}

/**
 * 开始下载资源
 * @param event
 * @param id
 * @returns {Promise<void>}
 */
export async function startDownloadLoading(event, id) {
    const list = m3u8VideoDownloadingListDB.data.loadingList
    const index = list.findIndex((item) => item.id === id)
    if(index > -1) {
        const item = m3u8VideoDownloadingListDB.data.loadingList[index];
        const string = fs.readFileSync(item.urlPath, 'utf-8')
        const json = global.JSON.parse(string)
        item.totalUrls = json.totalUrls
        item.m3u8Data = json.m3u8Data
        item.missLinks = json.missLinks
        item.isStart = true
        item.message = {
            status: 'success',
            content: `开始下载中...`
        }
        createWork(item)
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
        await createProcessFile(record.urlPath, record.totalUrls, record.m3u8Data, record.missLinks)
        list[index].pausing = false
    }
    await m3u8VideoDownloadingListDB.write()
}