import {dialog, ipcMain, shell} from 'electron'
import fs from "fs";

ipcMain.handle('open-directory-dialog', openDirectoryDialog)
ipcMain.handle('go-to-directory', goToDirectory)
ipcMain.handle('open-directory-and-file', openDirectoryAndFile)
ipcMain.handle('check-file-is-exist', checkFileIsExist)
ipcMain.handle('open-link-by-default-browser', openLinkByDefaultBrowser)
ipcMain.handle('get-file-content', getFileContent)

/**
 * 后端向前端推送信息
 * @param name
 * @param param1
 * @param param2
 * @param param3
 */
export function sendTips (name, param1, param2, param3, param4, param5, param6, param7, param8, param9, param10) {
    if(global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow && global.mainWindow.webContents.send(name, param1, param2, param3, param4, param5, param6, param7, param8, param9, param10)
    }
}

/**
 * 打开某个文件目录，用于选择文件目录，并获取目录
 * @returns {Promise<string>}
 */
export async function openDirectoryDialog() {
    const path = dialog.showOpenDialogSync({
        properties: ['openDirectory']
    })
    return path[0]
}

/**
 * 跳转到某个文件
 * @returns {Promise<void>}
 */
export async function goToDirectory(event, path) {
    if(fs.existsSync(path)) {
        shell.showItemInFolder(path)
        return 'success'
    } else {
        return 'failure'
    }
}

/**
 * 打开某个文件
 * @param event
 * @param path
 * @returns {Promise<void>}
 */
export async function openDirectoryAndFile(event, path) {
    if(fs.existsSync(path)) {
        await shell.openPath(path)
        return 'success'
    } else {
        return 'failure'
    }

}

/**
 * 检测某个文件是否存在
 * @returns {Promise<void>}
 */
export function checkFileIsExist(event, filePath) {
    return fs.existsSync(filePath)
}

/**
 * 用电脑默认浏览器打开链接
 */
export function openLinkByDefaultBrowser(event, link) {
    shell.openExternal(link)
}

/**
 * 获取文件里内容
 */
export function getFileContent(event, filePath) {
    if(fs.existsSync(filePath)){
        return fs.readFileSync(filePath, 'utf-8')
    }
}
