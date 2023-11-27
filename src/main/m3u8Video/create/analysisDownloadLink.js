import {ipcMain, app, BrowserWindow} from "electron";
import puppeteer from '../../util/source/puppeteer-core';
import { getTXDownloadLink } from './analysisByPlatform/tengxunVideo';

ipcMain.handle('get-download-link-from-url', getDownloadLinkFromUrl)

/**
 * 从一个网页里分析出可以下载link(m3u8url)
 * @returns {Promise<void>}
 */
async function getDownloadLinkFromUrl(event, htmlUrl) {
    try{
        if(/v\.qq\.com/.test(htmlUrl)) {
            return await getTXDownloadLink(htmlUrl, browser)
        } else {
            return await getNormalM3u8Link(htmlUrl)
        }
    } catch (e) {
        console.log(e)
        return "error"
    }

}

async function getNormalM3u8Link(htmlUrl) {
    let m3u8Url = null
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
    await page.setViewport({"width": 475, "height": 867, "isMobile": true})

    page.on('response', async response => {
        const url = response.url()
        if (/\.m3u8/.test(url)) {
            const text = await response.text()
            if(/#EXT-X-ENDLIST/.test(text))
            m3u8Url = url
        }
    });
    try {
        return await window.loadURL(htmlUrl, {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1'
        })
            .then((res) => {
                const promise = new Promise((resolve) => {
                    let index = 0
                    const interval = setInterval(() => {
                        console.log(`检测次数：${index + 1}`)
                        if (m3u8Url || index > 10) {
                            clearInterval(interval);
                            window && window.destroy();
                            resolve(m3u8Url)
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
