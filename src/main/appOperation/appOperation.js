import {app, ipcMain} from 'electron'

ipcMain.on('quit-app', quitApp)

function quitApp() {
    app.quit()
}

export default {
    quitApp
}