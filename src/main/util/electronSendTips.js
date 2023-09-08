import {dialog, ipcMain} from 'electron'

ipcMain.handle('open-directory-dialog', openDirectoryDialog)

export function sendTips (name, param1, param2, param3) {
    global.mainWindow.webContents.send(name, param1, param2, param3)
}

export async function openDirectoryDialog() {
    const path = dialog.showOpenDialogSync({
        properties: ['openDirectory']
    })
    return path[0]
}