import {dialog, ipcMain, shell} from 'electron'

ipcMain.handle('open-directory-dialog', openDirectoryDialog)
ipcMain.on('go-to-directory', goToDirectory)
ipcMain.on('open-directory-and-file', openDirectoryAndFile)
/**
 * 后端向前端推送信息
 * @param name
 * @param param1
 * @param param2
 * @param param3
 */
export function sendTips (name, param1, param2, param3) {
    global.mainWindow.webContents.send(name, param1, param2, param3)
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
    shell.showItemInFolder(path)
}

/**
 * 打开某个文件
 * @param event
 * @param path
 * @returns {Promise<void>}
 */
export async function openDirectoryAndFile(event, path) {
    await shell.openPath(path)
}