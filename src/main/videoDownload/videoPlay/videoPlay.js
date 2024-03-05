import {BrowserWindow, ipcMain} from "electron";
import {addWindow, deleteWindow, getWindow} from "../../service";
import path from "path";

ipcMain.handle('open-video-play-page', openVideoPlayPage)
ipcMain.on('close-video-play-window', closeVideoPlayWindow)
/**
 * 打开视频播放页面
 * @returns {Promise<void>}
 */
export async function openVideoPlayPage(event, videoPath, videoName) {
    let selfVideoPlayWindow = getWindow("selfVideoPlayWindow")
    if(!selfVideoPlayWindow) {
        const window = new BrowserWindow({
            width: 800,
            height: 640,
            show: true,
            title: videoName,
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
        // window.webContents.openDevTools();
        addWindow("selfVideoPlayWindow", window, '')
        window.on('closed', () => {
            deleteWindow("selfVideoPlayWindow")
        })
        if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
            await window.webContents.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/#/videoPlay?view=${encodeURIComponent(videoPath)}&name=${encodeURIComponent(videoName)}&sample=1`)
        } else {
            const urlPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
            await window.webContents.loadURL(`file://${urlPath}#/videoPlay?view=${encodeURIComponent(videoPath)}&name=${encodeURIComponent(videoName)}&sample=1`)
        }
    } else {
        selfVideoPlayWindow.window.setTitle(videoName)
        if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
            await selfVideoPlayWindow.window.webContents.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/#/videoPlay?view=${encodeURIComponent(videoPath)}&name=${encodeURIComponent(videoName)}&sample=1`)
        } else {
            const urlPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
            await selfVideoPlayWindow.window.webContents.loadURL(`file://${urlPath}#/videoPlay?view=${encodeURIComponent(videoPath)}&name=${encodeURIComponent(videoName)}&sample=1`)
        }
        selfVideoPlayWindow.window.focus()
        selfVideoPlayWindow.window.reload()
    }
}

/**
 * 关闭接口
 * @returns {Promise<void>}
 */
export async function closeVideoPlayWindow() {
    const selfVideoPlayWindow = getWindow("selfVideoPlayWindow")
    selfVideoPlayWindow && selfVideoPlayWindow.window.destroy()
    deleteWindow("selfVideoPlayWindow")
}
