import {Menu, app} from "electron";
import {m3u8VideoDownloadingListDB} from "../db/db";
import { sendTips } from "../util/electronOperations";

const template = [
    {
        label: '项目',
        submenu: [ {
            label: '退出',
            accelerator: 'Cmd+Q',
            click: closeTaskBeforeQuit
        },
            {
                label: '打开控制台',
                click: () => {
                    global.mainWindow.webContents.openDevTools()
                }
            }
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
function closeTaskBeforeQuit(isQuit) {
    sendTips('close-app-before-task-tip', '暂停下载任务中，完成暂停后关闭！')
    const list = m3u8VideoDownloadingListDB.data.loadingList
    const index = list.findIndex((item) => item.isStart && !item.pause)
    if(index > -1) {
        const item = m3u8VideoDownloadingListDB.data.loadingList[index];
        item.pause = true
        item.pausing = true
    }
    const interval = setInterval(() => {
        const index = list.findIndex((item) => (item.isStart && !item.pause) || (item.pause && item.pausing))
        if(index === -1) {
            clearInterval(interval)
            isQuit ? app.quit() : console.log('关闭')
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

