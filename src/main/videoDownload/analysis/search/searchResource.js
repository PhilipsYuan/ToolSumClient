import {app, BrowserWindow, ipcMain} from "electron";
import puppeteer from "../../../util/source/puppeteer-core";
import {sendTips} from "../../../util/electronOperations";
import path from "path";
import {addWindow, deleteWindow, getWindow} from "../../../service";

ipcMain.handle('get-search-result', searchResourceByKey)
ipcMain.handle('open-search-window', openSearchWindow)
ipcMain.on('confirm-search-window', confirmSearchWindow)
ipcMain.on('close-search-window', closeSearchWindow)

export async function searchResourceByKey(event, key) {
    let searchLink = null
    const searchUrl = `https://quark.sm.cn/s?q=${key}&safe=1&snum=6`
    const browser = await pie.connect(app, puppeteer);
    const window = new BrowserWindow({
        show: false, width: 900, height: 600, webPreferences: {
            devTools: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
            experimentalFeatures: true,
            webviewTag: true,
            autoplayPolicy: "document-user-activation-required"
        }
    });
    const page = await global.pie.getPage(browser, window)
    await page.setViewport({"width": 475, "height": 867, "isMobile": false})

    async function loadFun() {
        searchLink = await analysisResultDom(page)
    }
    page.once('load', loadFun)

    try {
        return await window.loadURL(searchUrl, {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1'
        })
            .then((res) => {
                const promise = new Promise((resolve) => {
                    let index = 0
                    const interval = setInterval(() => {
                        console.log(`检测次数：${index + 1}`)
                        if (searchLink || index > 3) {
                            clearInterval(interval);
                            window && window.destroy();
                            resolve(searchLink)
                        } else {
                            index++
                        }
                    }, 1000)
                })
                return promise
            })
            .catch((e) => {
                window && window.destroy();
                return 'error'
            })
    } catch (e) {
        window && window.destroy();
        return Promise.resolve('error')
    }
}

/**
 * 找出搜索结果的第一条
 * @param page
 * @returns {Promise<void>}
 */
async function analysisResultDom (page) {
    const searchLink = await page.evaluateHandle(() => {
        const results = document.querySelector('#results')
        const children = $(results).children()
        const matchResults = []
        children.forEach((item) => {
            /**
             * match 条件
             * 1. 是DIV标签
             * 2. 没有 ad_dot_url属性（有这个属性的是广告）
             * 3. 肯定有id属性
             * 4. 包含影院或影视关键字
             * 5. 包含data-reco属性
             */
            if (item.tagName === 'DIV' && !item.getAttribute('ad_dot_url')
                && item.getAttribute('id') && item.getAttribute('data-reco') != null
                && /影院|影视/.test(item.textContent)) {
                matchResults.push(item)
            }
        })
        if(matchResults.length > 0) {
            return matchResults[0].querySelector('a').href
        } else {
            return null
        }
    });
    const link = await searchLink.jsonValue()
    return link || null
}

/**
 * 打开新的窗口，让用户自己选择
 */
export async function openSearchWindow(event, searchText) {
    const searchUrl = `https://quark.sm.cn/s?q=${searchText}&safe=1&snum=20`
    let selfSearchWindow = getWindow("selfSearchWindow")
    if(!selfSearchWindow) {
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
        window.webContents.on("did-attach-webview", (e, webContent) => {
            addWindow("selfSearchWindow", window, webContent)
            // link 是当前页打开的
            webContent.on("will-navigate", (e, url) => {
                window.webContents.send('change-search-page-url', url)
            })
            // link 是新页打开的（target='_blank'）
            webContent.setWindowOpenHandler((details) => {
                window.webContents.send('change-search-page-url', details.url)
                return { action: 'deny' }
            })
        })
        window.on('closed', () => {
            deleteWindow("selfSearchWindow")
        })
        if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
            await window.webContents.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/#/search?view=${encodeURIComponent(searchUrl)}`)
        } else {
            const urlPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
            await window.webContents.loadURL(`file://${urlPath}#/search?view=${encodeURIComponent(searchUrl)}`)
        }
    } else {
        selfSearchWindow.window.focus()
        selfSearchWindow.window.webContents.send('change-search-page-url', searchUrl)
    }
}

/**
 * 确定页面后，关闭按钮
 * @param event
 * @param url
 * @returns {Promise<void>}
 */
export async function confirmSearchWindow(event, url) {
    sendTips("get-user-choose-search-page-url", url)
    const selfSearchWindow = getWindow("selfSearchWindow")
    selfSearchWindow.window.destroy()
    deleteWindow("selfSearchWindow")
}

/**
 * 关闭接口
 * @returns {Promise<void>}
 */
export async function closeSearchWindow() {
    const selfSearchWindow = getWindow("selfSearchWindow")
    selfSearchWindow.window.destroy()
    deleteWindow("selfSearchWindow")
}
