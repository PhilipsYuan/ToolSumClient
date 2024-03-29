import {Menu, app} from "electron";
import {m3u8VideoDownloadingListDB} from "../db/db";
import { sendTips } from "../util/electronOperations";
import {pauseMagnetDownloadVideo} from "../videoDownload/videoType/magnet/magnet";
import {pauseM3u8DownloadVideo} from "../videoDownload/videoType/m3u8Video/m3u8Video";
import packageJson from '../../../package.json'

const template = [
    {
        label: '项目',
        submenu: [
            {
                label: '关于小滑轮',
                click: () => {
                    global.mainWindow.webContents.send('open-about-xhl', packageJson.version)
                }
            },
            {
                label: '退出',
                accelerator: 'Cmd+Q',
                click: closeTaskBeforeQuit
            },
            // {
            //     label: '打开控制台',
            //     click: () => {
            //         global.mainWindow.webContents.openDevTools()
            //     }
            // }
        ]
    },
    {
        label: '编辑',
        submenu: [
            { label: '剪切', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
            { label: '复制', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
            { label: '粘贴', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
            { label: '全选', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:' }
        ]
    }
]

/**
 *
 */
function createMenu() {
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}

createMenu()

/**
 * 在退出之前结束，暂停任务
 */
export function closeTaskBeforeQuit(isQuit, windowToClose) {
    sendTips('close-app-before-task-tip', '暂停下载任务中，完成暂停后关闭！')
    const list = m3u8VideoDownloadingListDB.data.loadingList
    const downloadingItems = list.filter((item) => item.isStart && !item.pause)
    downloadingItems.forEach(async (item) => {
        if(item.type === 'magnet') {
            await pauseMagnetDownloadVideo(item)
        } else {
            await pauseM3u8DownloadVideo(item)
        }
    })
    const interval = setInterval(() => {
        const index = list.findIndex((item) => (item.isStart && !item.pause) || (item.pause && item.pausing))
        if(index === -1) {
            clearInterval(interval);
            isQuit ? app.quit() : windowToClose.close()
        }
    },500)
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        closeTaskBeforeQuit(true);
    }
});


