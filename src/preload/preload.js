// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import {contextBridge, ipcMain, ipcRenderer} from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
    // 渲染器进程到主进程（双向）
    // 渲染器进程到主进程（单向）
    quitApp: () => ipcRenderer.send('quit-app'),
    updateMenus: () => ipcRenderer.send('update-menus'),
    // 主进程到渲染器进程
})

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const dependency of ['chrome', 'node', 'electron']) {
        replaceText(`${dependency}-version`, process.versions[dependency] + "222")
    }
})