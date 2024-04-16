import {ipcMain} from "electron";
import { createM3u8DownloadTask } from "./videoType/m3u8Video/m3u8Video";
import { createMagnetDownloadTask } from "./videoType/magnet/magnet"
import { createBiliVideoDownloadTask } from "./videoType/bilibiliVideo/bilibiliVideo"
import { createMpdVideoDownloadTask } from './videoType/mpdVideo/mpdVideo'
import {makeDir} from "../util/fs";

ipcMain.handle('create-video-download-task', createVideoDownloadTask);

/**
 * 创建下载任务, 或者更新下载任务
 * @param event
 * @param url
 * @param name
 * @param outPath
 * @returns {Promise<string|string|undefined|*>}
 * isUpdate: 判断是更新还是创建
 * loadingId： 是更新的下载任务的Id
 */
 export async function createVideoDownloadTask(event, url, name, outPath, htmlUrl, audioUrl, isUpdate = false, loadingId) {
    makeDir(outPath)
     if(/magnet:/.test(url)) {
         return await createMagnetDownloadTask(event, url, name, outPath, htmlUrl, audioUrl)
     } else if(/bilivideo/.test(url) || (url && audioUrl)) {
         return await createBiliVideoDownloadTask(event, url, name, outPath, htmlUrl, audioUrl, isUpdate, loadingId)
    } else {
         return await createM3u8DownloadTask(event, url, name, outPath, htmlUrl, audioUrl, isUpdate, loadingId)
     }
}