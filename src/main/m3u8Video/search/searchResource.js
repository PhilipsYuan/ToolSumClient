import {app, BrowserWindow, ipcMain} from "electron";
import puppeteer from "../../util/source/puppeteer-core";

ipcMain.handle('get-search-result', searchResourceByKey)

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
        const aa = document.querySelector('#sc_yisou_porsche_1_1')
        return aa.querySelector('a').href
    });
    const link = await searchLink.jsonValue()
    return link || null
}