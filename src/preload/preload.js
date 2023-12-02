// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import {contextBridge, ipcRenderer} from 'electron'
import {callbackPromise} from "nodemailer/lib/shared";

contextBridge.exposeInMainWorld('electronAPI', {
    // 渲染器进程到主进程（双向）
    checkDownloadFileNotExist: (name, outputPath) => ipcRenderer.invoke('check-download-file-not-exist',  name, outputPath),
    getDownloadSetting: () => ipcRenderer.invoke('get-download-setting'),
    setDownloadSetting: (data) => ipcRenderer.invoke('set-download-setting',  data),
    openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
    getFinishList: (query) => ipcRenderer.invoke('get-m3u8-finish-list', query),
    deleteM3u8FinishedRecord: (id) => ipcRenderer.invoke('delete-m3u8-finished-record', id),
    deleteFinishedRecordAndFile: (id) => ipcRenderer.invoke('delete-m3u8-record-and-file', id),
    checkDownloadUrlNotExist: (url, name) => ipcRenderer.invoke('check-download-url-not-exist', url, name),
    getDownloadLinkFromUrl: (url) => ipcRenderer.invoke('get-download-link-from-url', url),
    createM3u8DownloadTask: (url, name, outPath) => ipcRenderer.invoke('create-m3u8-download-task',  url, name, outPath),
    getM3u8LoadingList: () => ipcRenderer.invoke('get-m3u8-loading-list'),
    deleteM3u8LoadingList: (id) => ipcRenderer.invoke('delete-m3u8-loading-list', id),
    startDownloadM3u8Video: (id) => ipcRenderer.invoke('start-download-one-loading', id),
    pauseM3u8DownloadVideo: (id) => ipcRenderer.invoke('pause-m3u8-download-Video', id),
    continueM3u8DownloadVideo: (id) => ipcRenderer.invoke('continue-m3u8-download-Video', id),
    goToDirectory: (path) => ipcRenderer.invoke('go-to-directory', path),
    openDirectoryAndFile: (path) => ipcRenderer.invoke('open-directory-and-file', path),
    getSearchResult: (key) => ipcRenderer.invoke('get-search-result', key),
    openSearchWindow: (key) => ipcRenderer.invoke('open-search-window', key),
    // 渲染器进程到主进程（单向）
    quitApp: () => ipcRenderer.send('quit-app'),
    updateMenus: () => ipcRenderer.send('update-menus'),
    // 主进程到渲染器进程
    getM3u8FileFailureTips: (callback) => ipcRenderer.on('m3u8-file-get-failure', callback),
    m3u8VideoDownloadSuccess: (callback) => ipcRenderer.on('m3u8-download-video-success', callback),
    showPauseTipBeforeClose: (callback) => ipcRenderer.on('close-app-before-task-tip', callback),
    deleteM3u8LoadingSuccess: (callback) => ipcRenderer.on('delete-m3u8-loading-success', callback),
    getUserChooseSearchPageUrl:(callback) => ipcRenderer.on('get-user-choose-search-page-url', callback),
    sendSearchPageUrlLoadFail: (callback) => ipcRenderer.on('search-page-url-load-Fail', callback)
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
