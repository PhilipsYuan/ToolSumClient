import { app } from "electron";
import { Low } from 'lowdb'
import { JSONFile } from "lowdb/node";
import {createDir, getFileInfo} from '../util/fs'

const basePath = app.getPath('userData')
const path = basePath + '/db'
// 创建project文件夹
createDir(path)

/**
 * m3u8视频下载完成列表
 * @returns {*}
 */
function getM3u8VideoDownloadListDB () {
    const jsonString = getFileInfo(`${path}/m3u8DownloadList.json`)
    const json = jsonString ? JSON.parse(jsonString) : ''
    const downloadList = new JSONFile(`${path}/m3u8DownloadList.json`)
    const M3u8VideoDownloadListDB = new Low(downloadList, json ? json : {downloadList: []})
    return M3u8VideoDownloadListDB
}

/**
 * m3u8视频下载中的列表
 */
function getM3u8VideoDownloadingDB () {
    const jsonString = getFileInfo(`${path}/m3u8DownloadingList.json`)
    const json = jsonString ? JSON.parse(jsonString) : ''
    const loadingList = new JSONFile(`${path}/m3u8DownloadingList.json`)
    const M3u8VideoDownloadingListDB = new Low(loadingList, json ? json : {loadingList: []})
    return M3u8VideoDownloadingListDB
}

/**
 * 软件的全局设置
 * @type {*}
 */
function getAppSettingsDB () {
    const jsonString = getFileInfo(`${path}/setting.json`)
    const json = jsonString ? JSON.parse(jsonString) : ''
    const settings = new JSONFile(`${path}/setting.json`)
    const settingsDB = new Low(settings, json ? json : {settings: {}})
    return settingsDB
}

export const m3u8VideoDownloadListDB = getM3u8VideoDownloadListDB()
export const settingsDB = getAppSettingsDB()
export const m3u8VideoDownloadingListDB = getM3u8VideoDownloadingDB()