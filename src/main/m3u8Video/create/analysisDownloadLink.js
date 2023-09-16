import {ipcMain, app, BrowserWindow} from "electron";
const puppeteer = require("puppeteer-core");
ipcMain.handle('get-download-link-from-url', getDownloadLinkFromUrl)

/**
 * 从一个网页里分析出可以下载link(m3u8url)
 * @returns {Promise<void>}
 */
async function getDownloadLinkFromUrl(event, htmlUrl) {
    let m3u8Url = null
    const browser = await global.pie.connect(app, puppeteer);
    const window = new BrowserWindow({
        show: false
    });
    const page = await pie.getPage(browser, window)
    function logRequest(request) {
        const url = request.url()
        if(/m3u8/.test(url)) {
            m3u8Url = url
            page.removeListener('request', logRequest);
        }
    }
    await page.on('request', logRequest);
    await window.loadURL(htmlUrl);
    const promise = new Promise((resolve) => {
        page.once('load', () => {
            window.destroy();
            resolve(m3u8Url)
        });
    })
    return promise
}
