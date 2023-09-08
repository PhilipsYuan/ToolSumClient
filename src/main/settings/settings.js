import {ipcMain} from "electron";
import { settingsDB } from "../db/db";


ipcMain.handle('get-download-setting', getDownloadSetting)
ipcMain.handle('set-download-setting', setDownloadSetting)

/**
 * 推荐股票的邮件设置
 * @returns {*|{}}
 */
export function getDownloadSetting () {
    const downloadSetting = settingsDB.data.settings.downloadSetting
    return downloadSetting || {}
}

async function setDownloadSetting (event, data) {
    const downloadSetting = settingsDB.data.settings.downloadSetting
    if(downloadSetting) {
        downloadSetting.downloadPath = data.downloadPath
    } else {
        settingsDB.data.settings.downloadSetting = {
            downloadPath: data.downloadPath,
        }
    }
    await settingsDB.write()
}