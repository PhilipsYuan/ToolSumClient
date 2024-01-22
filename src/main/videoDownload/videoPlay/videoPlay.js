import {BrowserWindow, ipcMain} from "electron";
import {getWindow} from "../../service";
import path from "path";

ipcMain.handle('open-video-play-page', openVideoPlayPage)
/**
 * 打开视频播放页面
 * @returns {Promise<void>}
 */
export async function openVideoPlayPage(event, videoPath) {
    let selfVideoPlayWindow = getWindow("selfVideoPlayWindow")
    if(!selfVideoPlayWindow) {
        const window = new BrowserWindow({
            show: true,
            closable: true,
            enableLargerThanScreen: true,
            titleBarStyle: 'hidden',
            webPreferences: {
                nodeIntegration: true,
                preload: path.join(__dirname, 'preload.js'),
                webSecurity: false,
                allowRunningInsecureContent: false,
                webviewTag: true
            },
        });
        window.webContents.openDevTools();
        if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
            await window.webContents.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/#/videoPlay?view=${encodeURIComponent(videoPath)}`)
        } else {
            const urlPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
            await window.webContents.loadURL(`file://${urlPath}#/videoPlay?view=${encodeURIComponent(videoPath)}`)
        }
    } else {
        selfVideoPlayWindow.window.focus()
    }
}