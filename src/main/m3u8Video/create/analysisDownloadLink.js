import {ipcMain, app, BrowserWindow} from "electron";
import puppeteer from '../../util/puppeteer-core'
ipcMain.handle('get-download-link-from-url', getDownloadLinkFromUrl)

/**
 * 从一个网页里分析出可以下载link(m3u8url)
 * @returns {Promise<void>}
 */
async function getDownloadLinkFromUrl(event, htmlUrl) {
    let m3u8Url = null
    const browser = await global.pie.connect(app, puppeteer);
    const window = new BrowserWindow({
        show: false,
        width: 900,
        height: 600,
        webPreferences: {
            devTools: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
            experimentalFeatures: true,
            webviewTag: true,
            autoplayPolicy: "document-user-activation-required"
        }
    });
    const page = await pie.getPage(browser, window)
    function logRequest(request) {
        const url = request.url()
        if(/\.m3u8$/.test(url)) {
            m3u8Url = url
        }
    }
    page.on('request', logRequest);
    try {
        await window.loadURL(htmlUrl, {
            userAgent: ' Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15'
        });
        const promise = new Promise((resolve) => {
            let index = 0
            const interval = setInterval(() => {
                console.log(`检测次数：${index + 1}`)
                if(m3u8Url || index > 9) {
                    clearInterval(interval)
                     window.destroy()
                    resolve(m3u8Url)
                } else {
                    index ++
                }
            }, 500)
        })
        return promise
    } catch (e) {
     return Promise.resolve('error')
    }
}
